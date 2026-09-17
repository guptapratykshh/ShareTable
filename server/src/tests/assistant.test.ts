import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { clearPendingActionsForTests } from "../assistant/pending.js";
import { User } from "../models/User.js";
import { Donation } from "../models/Donation.js";
import { Claim } from "../models/Claim.js";
import { Notification } from "../models/Notification.js";
import { seedDatabase } from "../scripts/seed.js";

process.env.DEMO_MODE = "false";
process.env.BEDROCK_MODEL_ID = "";

const app = createApp();
let mongo: MongoMemoryServer;

async function login(email: string, password = "Demo@123") {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  expect(res.status).toBe(200);
  return res.body.token as string;
}

async function claimRice(token: string, quantity = 10) {
  const donation = await Donation.findOne({ foodName: "Rice + Dal + Vegetables" });
  const res = await request(app)
    .post(`/api/donations/${donation!.id}/claim`)
    .set("Authorization", `Bearer ${token}`)
    .send({ quantity });
  expect(res.status).toBe(201);
  return res.body.claim as { id: string; claimCode: string; quantity: number };
}

beforeAll(async () => {
  process.env.BEDROCK_MODEL_ID = "";
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.createIndexes(), Donation.createIndexes(), Claim.createIndexes()]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  process.env.BEDROCK_MODEL_ID = "";
  clearPendingActionsForTests();
  await seedDatabase();
});

describe("ShareTable Assistant", () => {
  it("notifies the donor of a late pickup without exposing a pickup code", async () => {
    const hh = await login("helpinghands@foodrescue.demo");
    const claimed = await claimRice(hh, 10);

    const ask = await request(app)
      .post("/api/assistant")
      .set("Authorization", `Bearer ${hh}`)
      .send({ message: "I'll be 10 minutes late." });
    expect(ask.status).toBe(200);
    expect(ask.body.pendingActionId).toBeTruthy();
    expect(ask.body.reply).toMatch(/approximately 10 minutes late/i);
    expect(ask.body.reply).not.toMatch(/\b(?:ST|FR)-\d{4}\b/i);

    const confirmed = await request(app)
      .post("/api/assistant/confirm")
      .set("Authorization", `Bearer ${hh}`)
      .send({ pendingActionId: ask.body.pendingActionId });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.reply).toMatch(/notified/i);

    const donor = await login("mess@foodrescue.demo");
    const notes = await request(app).get("/api/notifications").set("Authorization", `Bearer ${donor}`);
    const late = notes.body.notifications.find((n: { type: string }) => n.type === "PICKUP_RUNNING_LATE");
    expect(late).toBeTruthy();
    expect(late.message).toMatch(/Helping Hands NGO expects to arrive about 10 minutes late for the 10-meal pickup/);
    expect(late.message).not.toMatch(/\b(?:ST|FR)-\d{4}\b/i);
    expect(late.message).not.toContain(claimed.claimCode);

    const donorView = await request(app)
      .get(`/api/claims/${claimed.id}`)
      .set("Authorization", `Bearer ${donor}`);
    expect(donorView.status).toBe(200);
    expect(donorView.body.claim.claimCode).toBeUndefined();
    expect(donorView.body.claim.lateMinutes).toBe(10);
  });

  it("lets a donor update pickup instructions and notifies the recipient", async () => {
    const hh = await login("helpinghands@foodrescue.demo");
    await claimRice(hh, 10);
    const donation = await Donation.findOne({ foodName: "Rice + Dal + Vegetables" });

    const donor = await login("mess@foodrescue.demo");
    const ask = await request(app)
      .post("/api/assistant")
      .set("Authorization", `Bearer ${donor}`)
      .send({ message: "I've kept the food near the security guard." });
    expect(ask.status).toBe(200);
    expect(ask.body.reply).toContain("Food has been kept near the security guard.");
    expect(ask.body.pendingActionId).toBeTruthy();

    const confirmed = await request(app)
      .post("/api/assistant/confirm")
      .set("Authorization", `Bearer ${donor}`)
      .send({ pendingActionId: ask.body.pendingActionId });
    expect(confirmed.status).toBe(200);

    const fresh = await Donation.findById(donation!.id);
    expect(fresh!.pickupInstructions).toBe("Food has been kept near the security guard.");

    const notes = await request(app).get("/api/notifications").set("Authorization", `Bearer ${hh}`);
    const updated = notes.body.notifications.find((n: { type: string }) => n.type === "PICKUP_INSTRUCTIONS_UPDATED");
    expect(updated).toBeTruthy();
    expect(updated.message).toBe("Pickup instructions updated: Food has been kept near the security guard.");
    expect(updated.message).not.toMatch(/\b(?:ST|FR)-\d{4}\b/i);
  });

  it("returns 403 when a recipient tries to confirm a donor's instruction update", async () => {
    const hh = await login("helpinghands@foodrescue.demo");
    await claimRice(hh, 10);
    const donor = await login("mess@foodrescue.demo");
    const ask = await request(app)
      .post("/api/assistant")
      .set("Authorization", `Bearer ${donor}`)
      .send({ message: "I've kept the food near the security guard." });

    const stolen = await request(app)
      .post("/api/assistant/confirm")
      .set("Authorization", `Bearer ${hh}`)
      .send({ pendingActionId: ask.body.pendingActionId });
    expect(stolen.status).toBe(403);

    const refused = await request(app)
      .post("/api/assistant")
      .set("Authorization", `Bearer ${hh}`)
      .send({ message: "I've kept the food near the security guard." });
    expect(refused.status).toBe(200);
    expect(refused.body.pendingActionId).toBeFalsy();
    expect(refused.body.reply).toMatch(/only the donor/i);

    const donation = await Donation.findOne({ foodName: "Rice + Dal + Vegetables" });
    expect(donation!.pickupInstructions).toBe("Enter from the west gate. Ask for the mess supervisor.");
  });

  it("answers the 1-hour pickup window from knowledge when Bedrock is unset", async () => {
    expect(process.env.BEDROCK_MODEL_ID).toBe("");
    const hh = await login("helpinghands@foodrescue.demo");
    const res = await request(app)
      .post("/api/assistant")
      .set("Authorization", `Bearer ${hh}`)
      .send({ message: "How long is the pickup window?" });
    expect(res.status).toBe(200);
    expect(res.body.pendingActionId).toBeFalsy();
    expect(res.body.reply).toMatch(/1 hour/);
  });

  it("answers packaging questions without falling through to the unknown prompt", async () => {
    const hh = await login("helpinghands@foodrescue.demo");
    const res = await request(app)
      .post("/api/assistant")
      .set("Authorization", `Bearer ${hh}`)
      .send({
        message: "do I have to bring my own containers food or will it be provided in a packet",
      });
    expect(res.status).toBe(200);
    expect(res.body.pendingActionId).toBeFalsy();
    expect(res.body.reply).toMatch(/does not provide packets/i);
    expect(res.body.reply).not.toMatch(/I can explain ShareTable pickup rules/i);
  });

  it("answers the pickup location range from knowledge", async () => {
    const hh = await login("helpinghands@foodrescue.demo");
    const res = await request(app)
      .post("/api/assistant")
      .set("Authorization", `Bearer ${hh}`)
      .send({ message: "what is the range of pickup locations?" });
    expect(res.status).toBe(200);
    expect(res.body.reply).toMatch(/2\.5 km/);
    expect(res.body.reply).toMatch(/4 km/);
    expect(res.body.reply).toMatch(/6 km/);
  });

  it("uses the open pickup deadline when asked when my meal expires", async () => {
    const hh = await login("helpinghands@foodrescue.demo");
    await claimRice(hh, 10);
    const res = await request(app)
      .post("/api/assistant")
      .set("Authorization", `Bearer ${hh}`)
      .send({ message: "What time does my pick meal expire/" });
    expect(res.status).toBe(200);
    expect(res.body.factsUsed).toContain("openPickups");
    expect(res.body.reply).toMatch(/Rice \+ Dal \+ Vegetables/);
    expect(res.body.reply).toMatch(/Pickup before/i);
    expect(res.body.reply).not.toMatch(/Each listing stays open for 1 hour/);
  });

  it("answers a peanut question from declared allergens on the open pickup", async () => {
    const hh = await login("helpinghands@foodrescue.demo");
    await claimRice(hh, 10);
    const res = await request(app)
      .post("/api/assistant")
      .set("Authorization", `Bearer ${hh}`)
      .send({ message: "I am deathly allergic to peanuts. Are there any peanuts in my order. can I get the allergen list" });
    expect(res.status).toBe(200);
    expect(res.body.reply).toMatch(/Peanuts/);
    expect(res.body.reply).toMatch(/donor declared/i);
    expect(res.body.reply).not.toMatch(/are not tracked/i);
    expect(res.body.factsUsed).toContain("allergens");
  });

  it("does not call an undeclared listing free of peanuts", async () => {
    const hh = await login("helpinghands@foodrescue.demo");
    const pulao = await Donation.findOne({ foodName: "Vegetable Pulao" });
    const claimed = await request(app)
      .post(`/api/donations/${pulao!.id}/claim`)
      .set("Authorization", `Bearer ${hh}`)
      .send({ quantity: 5 });
    expect(claimed.status).toBe(201);

    const res = await request(app)
      .post("/api/assistant")
      .set("Authorization", `Bearer ${hh}`)
      .send({ message: "Are there any peanuts in my order" });
    expect(res.status).toBe(200);
    expect(res.body.reply).toMatch(/did not declare allergens/i);
    expect(res.body.reply).not.toMatch(/\bno peanuts\b/i);
    expect(res.body.reply).toMatch(/not a guarantee/i);
  });

  it("does not run an action on someone else's claim even if that claimId is hinted", async () => {
    const hh = await login("helpinghands@foodrescue.demo");
    const ffa = await login("foodforall@foodrescue.demo");
    const theirs = await claimRice(hh, 10);
    const mine = await claimRice(ffa, 8);

    const ask = await request(app)
      .post("/api/assistant")
      .set("Authorization", `Bearer ${ffa}`)
      .send({ message: `I'll be 10 minutes late. ${theirs.id}` });
    expect(ask.status).toBe(200);
    expect(ask.body.pendingActionId).toBeTruthy();

    const confirmed = await request(app)
      .post("/api/assistant/confirm")
      .set("Authorization", `Bearer ${ffa}`)
      .send({ pendingActionId: ask.body.pendingActionId });
    expect(confirmed.status).toBe(200);

    const otherClaim = await Claim.findById(theirs.id);
    const ownClaim = await Claim.findById(mine.id);
    expect(otherClaim!.lateMinutes).toBeUndefined();
    expect(ownClaim!.lateMinutes).toBe(10);
  });

  it("does not notify or mutate twice when the same pending action is confirmed twice", async () => {
    const hh = await login("helpinghands@foodrescue.demo");
    const claimed = await claimRice(hh, 10);
    const donorUser = await User.findOne({ email: "mess@foodrescue.demo" });

    const ask = await request(app)
      .post("/api/assistant")
      .set("Authorization", `Bearer ${hh}`)
      .send({ message: "I'll be 10 minutes late." });

    const first = await request(app)
      .post("/api/assistant/confirm")
      .set("Authorization", `Bearer ${hh}`)
      .send({ pendingActionId: ask.body.pendingActionId });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post("/api/assistant/confirm")
      .set("Authorization", `Bearer ${hh}`)
      .send({ pendingActionId: ask.body.pendingActionId });
    expect(second.status).toBe(200);
    expect(second.body.reply).toBe(first.body.reply);

    const lates = await Notification.find({
      recipientId: donorUser!._id,
      type: "PICKUP_RUNNING_LATE",
      claimId: claimed.id,
    });
    expect(lates).toHaveLength(1);

    const claim = await Claim.findById(claimed.id);
    expect(claim!.lateMinutes).toBe(10);
  });
});
