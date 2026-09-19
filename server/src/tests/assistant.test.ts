import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { clearPendingActionsForTests, getPendingAction } from "../assistant/pending.js";
import { User } from "../models/User.js";
import { Donation } from "../models/Donation.js";
import { Claim } from "../models/Claim.js";
import { Notification } from "../models/Notification.js";
import { seedDatabase } from "../scripts/seed.js";

process.env.DEMO_MODE = "false";
process.env.LLM_PROVIDER = "none";
process.env.GROQ_API_KEY = "";
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
  process.env.LLM_PROVIDER = "none";
  process.env.GROQ_API_KEY = "";
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
  process.env.LLM_PROVIDER = "none";
  process.env.GROQ_API_KEY = "";
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

    const donor = await login("pratykshgupta9999@gmail.com");
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

    const donor = await login("pratykshgupta9999@gmail.com");
    const ask = await request(app)
      .post("/api/assistant")
      .set("Authorization", `Bearer ${donor}`)
      .send({ message: "I've kept the food near the security guard." });
    expect(ask.status).toBe(200);
    expect(ask.body.reply).toMatch(/i've kept the food near the security guard/i);
    expect(ask.body.pendingActionId).toBeTruthy();

    const confirmed = await request(app)
      .post("/api/assistant/confirm")
      .set("Authorization", `Bearer ${donor}`)
      .send({ pendingActionId: ask.body.pendingActionId });
    expect(confirmed.status).toBe(200);

    const fresh = await Donation.findById(donation!.id);
    expect(fresh!.pickupInstructions).toBe("i've kept the food near the security guard.");

    const notes = await request(app).get("/api/notifications").set("Authorization", `Bearer ${hh}`);
    const updated = notes.body.notifications.find((n: { type: string }) => n.type === "PICKUP_INSTRUCTIONS_UPDATED");
    expect(updated).toBeTruthy();
    expect(updated.message).toBe("Pickup instructions updated: i've kept the food near the security guard.");
    expect(updated.message).not.toMatch(/\b(?:ST|FR)-\d{4}\b/i);
  });

  it("returns 403 when a recipient tries to confirm a donor's instruction update", async () => {
    const hh = await login("helpinghands@foodrescue.demo");
    await claimRice(hh, 10);
    const donor = await login("pratykshgupta9999@gmail.com");
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

  it("answers the 1-hour pickup window from knowledge when the LLM is unset", async () => {
    expect(process.env.BEDROCK_MODEL_ID).toBe("");
    expect(process.env.GROQ_API_KEY).toBe("");
    expect(process.env.LLM_PROVIDER).toBe("none");
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
    expect(ask.body.pendingActionId).toBeFalsy();
    expect(ask.body.reply).toMatch(/couldn't find that open pickup/i);

    const otherClaim = await Claim.findById(theirs.id);
    const ownClaim = await Claim.findById(mine.id);
    expect(otherClaim!.lateMinutes).toBeUndefined();
    expect(ownClaim!.lateMinutes).toBeUndefined();
  });

  it("does not notify or mutate twice when the same pending action is confirmed twice", async () => {
    const hh = await login("helpinghands@foodrescue.demo");
    const claimed = await claimRice(hh, 10);
    const donorUser = await User.findOne({ email: "pratykshgupta9999@gmail.com" });

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

  it("answers pickup location from the open pickup address", async () => {
    const hh = await login("helpinghands@foodrescue.demo");
    await claimRice(hh, 10);
    const res = await request(app)
      .post("/api/assistant")
      .set("Authorization", `Bearer ${hh}`)
      .send({ message: "what was the location of the pickup" });
    expect(res.status).toBe(200);
    expect(res.body.reply).toMatch(/College Cafeteria, Polaris Campus/);
    expect(res.body.factsUsed).toContain("openPickups");
  });

  it("answers pickup location from a recent completed pickup", async () => {
    const hh = await login("helpinghands@foodrescue.demo");
    const claimed = await claimRice(hh, 10);
    await Claim.findByIdAndUpdate(claimed.id, {
      status: "PICKED_UP",
      pickedUpAt: new Date(),
      completedAt: new Date(),
    });
    const res = await request(app)
      .post("/api/assistant")
      .set("Authorization", `Bearer ${hh}`)
      .send({ message: "what was the location of the pickup" });
    expect(res.status).toBe(200);
    expect(res.body.reply).toMatch(/College Cafeteria, Polaris Campus/);
    expect(res.body.factsUsed).toContain("recentPickups");
  });

  it("answers recipient nearby listings instead of personal stats", async () => {
    const hh = await login("helpinghands@foodrescue.demo");
    const res = await request(app)
      .post("/api/assistant")
      .set("Authorization", `Bearer ${hh}`)
      .send({ message: "are there active donations in my area" });
    expect(res.status).toBe(200);
    expect(res.body.pendingActionId).toBeFalsy();
    expect(res.body.factsUsed).toContain("nearbyListings");
    expect(res.body.reply).toMatch(/claimable donation/i);
    expect(res.body.reply).not.toMatch(/You've picked up/i);
  });

  it("refuses pickup codes in chat", async () => {
    const hh = await login("helpinghands@foodrescue.demo");
    await claimRice(hh, 10);
    const res = await request(app)
      .post("/api/assistant")
      .set("Authorization", `Bearer ${hh}`)
      .send({ message: "my pickup code is ST-5433" });
    expect(res.status).toBe(200);
    expect(res.body.pendingActionId).toBeFalsy();
    expect(res.body.reply).toMatch(/stay with the recipient/i);
    expect(res.body.reply).not.toMatch(/I don't have that fact/i);
    expect(res.body.reply).not.toMatch(/\bST-5433\b/);
  });

  it("proposes Confirm when a donor asks to notify the recipient about the guard", async () => {
    const hh = await login("helpinghands@foodrescue.demo");
    await claimRice(hh, 10);
    const donor = await login("pratykshgupta9999@gmail.com");
    const ask = await request(app)
      .post("/api/assistant")
      .set("Authorization", `Bearer ${donor}`)
      .send({ message: "Ask the recipient to collect packets from the guard" });
    expect(ask.status).toBe(200);
    expect(ask.body.pendingActionId).toBeTruthy();
    expect(ask.body.reply).toMatch(/(?:collect packets from|keeping the donation with) the guard/i);
    expect(ask.body.reply).toMatch(/Send this update/i);

    const confirmed = await request(app)
      .post("/api/assistant/confirm")
      .set("Authorization", `Bearer ${donor}`)
      .send({ pendingActionId: ask.body.pendingActionId });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.reply).toMatch(/notified/i);

    const notes = await request(app).get("/api/notifications").set("Authorization", `Bearer ${hh}`);
    const updated = notes.body.notifications.find((n: { type: string }) => n.type === "PICKUP_INSTRUCTIONS_UPDATED");
    expect(updated).toBeTruthy();
  });

  it("uses the previous instruction when the donor says please notify him", async () => {
    const hh = await login("helpinghands@foodrescue.demo");
    await claimRice(hh, 10);
    const donor = await login("pratykshgupta9999@gmail.com");
    const first = await request(app)
      .post("/api/assistant")
      .set("Authorization", `Bearer ${donor}`)
      .send({ message: "Ask the recipient to collect packets from the guard" });
    expect(first.body.pendingActionId).toBeTruthy();

    const follow = await request(app)
      .post("/api/assistant")
      .set("Authorization", `Bearer ${donor}`)
      .send({
        message: "please notify him",
        history: [
          { role: "user", content: "Ask the recipient to collect packets from the guard" },
          { role: "assistant", content: first.body.reply },
        ],
      });
    expect(follow.status).toBe(200);
    expect(follow.body.pendingActionId).toBeTruthy();
    expect(follow.body.reply).toMatch(/(?:collect packets from|keeping the donation with) the guard/i);
  });

  it("does not notify on unrelated chat", async () => {
    const donor = await login("pratykshgupta9999@gmail.com");
    const before = await Notification.countDocuments();
    const res = await request(app)
      .post("/api/assistant")
      .set("Authorization", `Bearer ${donor}`)
      .send({ message: "what's the weather in Bengaluru today" });
    expect(res.status).toBe(200);
    expect(res.body.pendingActionId).toBeFalsy();
    expect(res.body.reply).toMatch(/only help/i);
    expect(await Notification.countDocuments()).toBe(before);
  });

  it("answers veg vs non-veg from the listing category", async () => {
    const hh = await login("helpinghands@foodrescue.demo");
    await claimRice(hh, 10);
    const res = await request(app)
      .post("/api/assistant")
      .set("Authorization", `Bearer ${hh}`)
      .send({ message: "The meal is non veg right" });
    expect(res.status).toBe(200);
    expect(res.body.factsUsed).toContain("diet");
    expect(res.body.reply).toMatch(/Vegetarian/);
    expect(res.body.reply).not.toMatch(/Yes, the meal is non-veg/i);
  });

  it("does not invent veg vs non-veg from a non-diet category", async () => {
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
      .send({ message: "is the meal non veg" });
    expect(res.status).toBe(200);
    expect(res.body.factsUsed).toContain("diet");
    expect(res.body.reply).toMatch(/Rice\/Grains/);
    expect(res.body.reply).toMatch(/does not confirm/i);
    expect(res.body.reply).not.toMatch(/Yes, the meal is non-veg/i);
  });

  it("proposes Confirm when a donor notifies the picker about the guard and a pickup code", async () => {
    const hh = await login("helpinghands@foodrescue.demo");
    await claimRice(hh, 10);
    const donor = await login("pratykshgupta9999@gmail.com");
    const ask = await request(app)
      .post("/api/assistant")
      .set("Authorization", `Bearer ${donor}`)
      .send({
        message: "notify the picker that i am keeping the donation with the guard , send the pickup code once reached",
      });
    expect(ask.status).toBe(200);
    expect(ask.body.pendingActionId).toBeTruthy();
    expect(ask.body.reply).toMatch(/(?:collect packets from|keeping the donation with) the guard/i);
    expect(ask.body.reply).toMatch(/Send this update/i);
    expect(ask.body.reply).not.toMatch(/\b(?:ST|FR)-\d{4}\b/i);
    expect(ask.body.reply).not.toMatch(/2 meals of/i);

    const confirmed = await request(app)
      .post("/api/assistant/confirm")
      .set("Authorization", `Bearer ${donor}`)
      .send({ pendingActionId: ask.body.pendingActionId });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.reply).toMatch(/notified/i);

    const notes = await request(app).get("/api/notifications").set("Authorization", `Bearer ${hh}`);
    const updated = notes.body.notifications.find((n: { type: string }) => n.type === "PICKUP_INSTRUCTIONS_UPDATED");
    expect(updated).toBeTruthy();
    expect(updated.message).toMatch(/with the guard/i);
    expect(updated.message).not.toMatch(/\b(?:ST|FR)-\d{4}\b/i);
  });

  it("reuses the guard instruction when the donor says yes inform her then notify her", async () => {
    const hh = await login("helpinghands@foodrescue.demo");
    await claimRice(hh, 10);
    const donor = await login("pratykshgupta9999@gmail.com");
    const firstMsg =
      "notify the picker that i am keeping the donation with the guard , send the pickup code once reached";
    const first = await request(app)
      .post("/api/assistant")
      .set("Authorization", `Bearer ${donor}`)
      .send({ message: firstMsg });
    expect(first.body.pendingActionId).toBeTruthy();

    const follow = await request(app)
      .post("/api/assistant")
      .set("Authorization", `Bearer ${donor}`)
      .send({
        message: "yes, inform her then notify her",
        history: [
          { role: "user", content: firstMsg },
          { role: "assistant", content: first.body.reply },
        ],
      });
    expect(follow.status).toBe(200);
    expect(follow.body.pendingActionId).toBeTruthy();
    expect(follow.body.reply).toMatch(/(?:collect packets from|keeping the donation with) the guard/i);
    expect(follow.body.reply).not.toMatch(/yes, inform her then notify her/i);
  });

  it("treats a corrected guard message as a new instruction update", async () => {
    const hh = await login("helpinghands@foodrescue.demo");
    await claimRice(hh, 10);
    const donor = await login("pratykshgupta9999@gmail.com");
    const ask = await request(app)
      .post("/api/assistant")
      .set("Authorization", `Bearer ${donor}`)
      .send({
        message: "no , t i am keeping the donation with the guard , send the pickup code once reached",
      });
    expect(ask.status).toBe(200);
    expect(ask.body.pendingActionId).toBeTruthy();
    expect(ask.body.reply).toMatch(/(?:collect packets from|keeping the donation with) the guard/i);
    expect(ask.body.reply).not.toMatch(/2 meals of/i);
  });

  it("proposes Confirm when a recipient states a clock-time ETA", async () => {
    const hh = await login("helpinghands@foodrescue.demo");
    await claimRice(hh, 10);
    const claim = await Claim.findOne({ status: { $in: ["CLAIMED", "PICKUP_PENDING"] } }).sort({ claimedAt: -1 });
    const deadline = claim!.pickupDeadline;
    const arrive = new Date(deadline.getTime() - 5 * 60_000);
    const hour12 = arrive.getHours() % 12 || 12;
    const minute = String(arrive.getMinutes()).padStart(2, "0");
    const meridiem = arrive.getHours() >= 12 ? "pm" : "am";
    const label = `${hour12}:${minute} ${meridiem}`;

    const ask = await request(app)
      .post("/api/assistant")
      .set("Authorization", `Bearer ${hh}`)
      .send({ message: `I will be reaching the location at ${label}` });
    expect(ask.status).toBe(200);
    expect(ask.body.pendingActionId).toBeTruthy();
    expect(ask.body.reply).toMatch(new RegExp(`arrive around ${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"));
    expect(ask.body.reply).not.toMatch(/let me know when you arrive/i);

    const confirmed = await request(app)
      .post("/api/assistant/confirm")
      .set("Authorization", `Bearer ${hh}`)
      .send({ pendingActionId: ask.body.pendingActionId });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.reply).toMatch(/notified/i);
    expect(confirmed.body.reply).toMatch(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));

    const donor = await login("pratykshgupta9999@gmail.com");
    const notes = await request(app).get("/api/notifications").set("Authorization", `Bearer ${donor}`);
    const eta = notes.body.notifications.find(
      (n: { type: string; message: string }) =>
        n.type === "PICKUP_RUNNING_LATE" && n.message.toLowerCase().includes("around"),
    );
    expect(eta).toBeTruthy();
    expect(eta.message).toMatch(/Helping Hands NGO/);
    expect(eta.message).toMatch(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  });

  it("relays a recipient gate request to the donor after Confirm", async () => {
    const hh = await login("helpinghands@foodrescue.demo");
    await claimRice(hh, 10);
    const ask = await request(app)
      .post("/api/assistant")
      .set("Authorization", `Bearer ${hh}`)
      .send({
        message: "I am at the location but there is no one, can you please tell the donor to come to the gate",
      });
    expect(ask.status).toBe(200);
    expect(ask.body.pendingActionId).toBeTruthy();
    expect(ask.body.reply).toMatch(/come to the gate/i);
    expect(ask.body.reply).toMatch(/Send this update/i);
    expect(ask.body.reply).not.toMatch(/Nothing is sent until you confirm/i);
    expect(ask.body.reply).not.toMatch(/Only the donor/i);

    const confirmed = await request(app)
      .post("/api/assistant/confirm")
      .set("Authorization", `Bearer ${hh}`)
      .send({ pendingActionId: ask.body.pendingActionId });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.reply).toMatch(/notified/i);

    const donor = await login("pratykshgupta9999@gmail.com");
    const notes = await request(app).get("/api/notifications").set("Authorization", `Bearer ${donor}`);
    const msg = notes.body.notifications.find((n: { type: string }) => n.type === "PICKUP_MESSAGE");
    expect(msg).toBeTruthy();
    expect(msg.message).toMatch(/Helping Hands NGO/);
    expect(msg.message).toMatch(/come to the gate/i);
    expect(msg.message).not.toMatch(/\b(?:ST|FR)-\d{4}\b/i);
  });

  it("reuses the relay body when the recipient says yes inform him", async () => {
    const hh = await login("helpinghands@foodrescue.demo");
    await claimRice(hh, 10);
    const firstMsg =
      "I am at the location but there is no one, can you please tell the donor to come to the gate";
    const first = await request(app)
      .post("/api/assistant")
      .set("Authorization", `Bearer ${hh}`)
      .send({ message: firstMsg });
    expect(first.body.pendingActionId).toBeTruthy();

    const follow = await request(app)
      .post("/api/assistant")
      .set("Authorization", `Bearer ${hh}`)
      .send({
        message: "yes inform him",
        history: [
          { role: "user", content: firstMsg },
          { role: "assistant", content: first.body.reply },
        ],
      });
    expect(follow.status).toBe(200);
    expect(follow.body.pendingActionId).toBeTruthy();
    expect(follow.body.reply).toMatch(/come to the gate/i);
    expect(follow.body.reply).not.toMatch(/Only the donor/i);
  });

  it("lets a donor relay a non-instruction ping to the recipient", async () => {
    const hh = await login("helpinghands@foodrescue.demo");
    await claimRice(hh, 10);
    const donor = await login("pratykshgupta9999@gmail.com");
    const ask = await request(app)
      .post("/api/assistant")
      .set("Authorization", `Bearer ${donor}`)
      .send({ message: "tell the recipient to please come soon" });
    expect(ask.status).toBe(200);
    expect(ask.body.pendingActionId).toBeTruthy();
    expect(ask.body.reply).toMatch(/come/i);
    expect(ask.body.reply).toMatch(/Send this update/i);

    const confirmed = await request(app)
      .post("/api/assistant/confirm")
      .set("Authorization", `Bearer ${donor}`)
      .send({ pendingActionId: ask.body.pendingActionId });
    expect(confirmed.status).toBe(200);

    const notes = await request(app).get("/api/notifications").set("Authorization", `Bearer ${hh}`);
    const msg = notes.body.notifications.find((n: { type: string }) => n.type === "PICKUP_MESSAGE");
    expect(msg).toBeTruthy();
  });

  it("still treats pure arrival as ARRIVED without a relay request", async () => {
    const hh = await login("helpinghands@foodrescue.demo");
    await claimRice(hh, 10);
    const ask = await request(app)
      .post("/api/assistant")
      .set("Authorization", `Bearer ${hh}`)
      .send({ message: "I've arrived at the door" });
    expect(ask.status).toBe(200);
    expect(ask.body.pendingActionId).toBeTruthy();
    expect(ask.body.reply).toMatch(/arrived/i);
  });

  it("treats reached plus come to the gate as a pending relay", async () => {
    const hh = await login("helpinghands@foodrescue.demo");
    await claimRice(hh, 10);
    const ask = await request(app)
      .post("/api/assistant")
      .set("Authorization", `Bearer ${hh}`)
      .send({ message: "I have reached the location, please come to the gate" });
    expect(ask.status).toBe(200);
    expect(ask.body.pendingActionId).toBeTruthy();
    expect(ask.body.reply).toMatch(/gate/i);
    expect(ask.body.reply).toMatch(/Send this update/i);
  });

  it("confirms an open pending when the recipient types send it", async () => {
    const hh = await login("helpinghands@foodrescue.demo");
    await claimRice(hh, 10);
    const ask = await request(app)
      .post("/api/assistant")
      .set("Authorization", `Bearer ${hh}`)
      .send({ message: "I have reached the location, please come to the gate" });
    expect(ask.body.pendingActionId).toBeTruthy();

    const confirm = await request(app)
      .post("/api/assistant")
      .set("Authorization", `Bearer ${hh}`)
      .send({
        message: "send it",
        history: [
          { role: "user", content: "I have reached the location, please come to the gate" },
          { role: "assistant", content: ask.body.reply },
        ],
      });
    expect(confirm.status).toBe(200);
    expect(confirm.body.pendingActionId).toBeFalsy();
    expect(confirm.body.reply).toMatch(/sent|notified/i);

    const donor = await login("pratykshgupta9999@gmail.com");
    const notes = await request(app).get("/api/notifications").set("Authorization", `Bearer ${donor}`);
    const msg = notes.body.notifications.find((n: { type: string }) => n.type === "PICKUP_MESSAGE");
    expect(msg).toBeTruthy();
    expect(msg.message).toMatch(/gate/i);
  });

  it("relays a donor ask-her note without inventing pickup instructions", async () => {
    const hh = await login("helpinghands@foodrescue.demo");
    await claimRice(hh, 10);
    const donor = await login("pratykshgupta9999@gmail.com");
    const ask = await request(app)
      .post("/api/assistant")
      .set("Authorization", `Bearer ${donor}`)
      .send({ message: "ask her to message when she reaches the gate" });
    expect(ask.status).toBe(200);
    expect(ask.body.pendingActionId).toBeTruthy();
    expect(ask.body.reply).toMatch(/Send this update/i);
    expect(ask.body.reply).not.toMatch(/please come to the pickup soon/i);
    expect(ask.body.reply).toMatch(/gate|reaches|message/i);
  });
  function assistantNotificationCount() {
    return Notification.countDocuments({ type: { $in: ["PICKUP_RUNNING_LATE", "PICKUP_INSTRUCTIONS_UPDATED", "PICKUP_ARRIVED", "PICKUP_MESSAGE"] } });
  }

  async function chat(token: string, message: string, extra: Record<string, unknown> = {}) {
    const response = await request(app).post("/api/assistant").set("Authorization", `Bearer ${token}`).send({ message, ...extra });
    expect(response.status).toBe(200);
    return response.body;
  }

  async function confirmAction(token: string, pendingActionId: string) {
    return request(app).post("/api/assistant/confirm").set("Authorization", `Bearer ${token}`).send({ pendingActionId });
  }

  it("asks for a missing delay and sends only after the completed preview is confirmed", async () => {
    const token = await login("helpinghands@foodrescue.demo");
    const claim = await claimRice(token);
    const before = await assistantNotificationCount();
    const question = await chat(token, "I'm stuck in traffic and running late");
    expect(question.pendingActionId).toBeFalsy();
    expect(question.reply).toMatch(/how many minutes/i);
    const incomplete = await chat(token, "yes");
    expect(incomplete.pendingActionId).toBeFalsy();
    expect(incomplete.reply).toMatch(/still need the number of minutes/i);
    const preview = await chat(token, "twenty-five minutes");
    expect(preview.pendingActionId).toBeTruthy();
    expect(preview.reply).toMatch(/25 minutes late/);
    expect(await assistantNotificationCount()).toBe(before);
    expect((await Claim.findById(claim.id))!.lateMinutes).toBeUndefined();
    await chat(token, "yes please", { pendingActionId: preview.pendingActionId });
    expect((await Claim.findById(claim.id))!.lateMinutes).toBe(25);
    expect(await assistantNotificationCount()).toBe(before + 1);
  });

  it("requires a new confirmation after a delay correction", async () => {
    const token = await login("helpinghands@foodrescue.demo");
    const claim = await claimRice(token);
    const before = await assistantNotificationCount();
    const first = await chat(token, "I'll be 10 minutes late");
    const corrected = await chat(token, "actually 20 minutes");
    expect(corrected.pendingActionId).toBeTruthy();
    expect(corrected.pendingActionId).not.toBe(first.pendingActionId);
    expect(corrected.reply).toMatch(/20 minutes late/);
    expect((await confirmAction(token, first.pendingActionId)).status).toBe(404);
    expect(await assistantNotificationCount()).toBe(before);
    await chat(token, "send it", { pendingActionId: corrected.pendingActionId });
    expect((await Claim.findById(claim.id))!.lateMinutes).toBe(20);
  });

  it("retires the old proposal if a correction is unclear", async () => {
    const token = await login("helpinghands@foodrescue.demo");
    await claimRice(token);
    const preview = await chat(token, "I'll be 10 minutes late");
    const correction = await chat(token, "actually never mind the wording, change it");
    expect(correction.pendingActionId).toBeFalsy();
    expect(correction.reply).toMatch(/full replacement/i);
    expect((await confirmAction(token, preview.pendingActionId)).status).toBe(404);
  });

  it.each(["no", "don't send it", "don’t send it yet", "hold on", "not yet", "cancel the message"])("cancels without sending when the user says %s", async message => {
    const token = await login("helpinghands@foodrescue.demo");
    await claimRice(token);
    const before = await assistantNotificationCount();
    const preview = await chat(token, "I have reached the location, please come to the gate");
    const cancelled = await chat(token, message, { pendingActionId: preview.pendingActionId });
    expect(cancelled.reply).toMatch(/cancelled/i);
    expect(cancelled.pendingActionId).toBeFalsy();
    expect((await confirmAction(token, preview.pendingActionId)).status).toBe(404);
    const follow = await chat(token, "send it", { history: [{ role: "user", content: "Please come to the gate" }] });
    expect(follow.pendingActionId).toBeFalsy();
    expect(follow.reply).toMatch(/new preview/i);
    expect(await assistantNotificationCount()).toBe(before);
  });

  it("does not interpret cancellation of a pickup as cancellation of only its message", async () => {
    const token = await login("helpinghands@foodrescue.demo");
    const claim = await claimRice(token);
    const preview = await chat(token, "I've arrived");
    const reply = await chat(token, "cancel my pickup");
    expect(reply.reply).toMatch(/details to cancel/i);
    expect((await Claim.findById(claim.id))!.status).toBe("PICKUP_PENDING");
    expect((await confirmAction(token, preview.pendingActionId)).status).toBe(404);
  });

  it("does not send an update that the browser has not previewed", async () => {
    const token = await login("helpinghands@foodrescue.demo");
    await claimRice(token);
    const before = await assistantNotificationCount();
    await chat(token, "I've arrived");
    const reply = await chat(token, "send it", { pendingActionId: null });
    expect(reply.reply).toMatch(/no matching update/i);
    expect(await assistantNotificationCount()).toBe(before);
  });

  it("deduplicates simultaneous button and chat confirmations", async () => {
    const token = await login("helpinghands@foodrescue.demo");
    const claim = await claimRice(token);
    const preview = await chat(token, "I am at the east gate, please come to gate 2");
    const responses = await Promise.all([
      confirmAction(token, preview.pendingActionId),
      request(app).post("/api/assistant").set("Authorization", `Bearer ${token}`).send({ message: "send it", pendingActionId: preview.pendingActionId }),
      confirmAction(token, preview.pendingActionId),
    ]);
    for (const response of responses) expect(response.status).toBe(200);
    const notes = await Notification.find({ claimId: claim.id, type: "PICKUP_MESSAGE" });
    expect(notes).toHaveLength(1);
    expect(notes[0].message).toMatch(/gate 2/);
    expect(notes[0].message).toMatch(/east gate/);
  });

  it("asks which pickup to use and remembers the draft while the user chooses", async () => {
    const token = await login("helpinghands@foodrescue.demo");
    const rice = await claimRice(token);
    const pulao = await Donation.findOne({ foodName: "Vegetable Pulao" });
    const second = await request(app).post(`/api/donations/${pulao!.id}/claim`).set("Authorization", `Bearer ${token}`).send({ quantity: 5 });
    expect(second.status).toBe(201);
    const before = await assistantNotificationCount();
    const question = await chat(token, "I have reached the gate, please come outside");
    expect(question.pendingActionId).toBeFalsy();
    expect(question.reply).toMatch(/which pickup/i);
    const preview = await chat(token, "rice");
    expect(preview.pendingActionId).toBeTruthy();
    expect(preview.reply).toMatch(/Rice \+ Dal \+ Vegetables/);
    expect(await assistantNotificationCount()).toBe(before);
    await chat(token, "send it", { pendingActionId: preview.pendingActionId });
    expect(await Notification.countDocuments({ claimId: rice.id, type: "PICKUP_MESSAGE" })).toBe(1);
    expect(await Notification.countDocuments({ claimId: second.body.claim.id, type: "PICKUP_MESSAGE" })).toBe(0);
  });

  it("does not retarget a confirmed update when its original pickup closes", async () => {
    const token = await login("helpinghands@foodrescue.demo");
    const rice = await claimRice(token);
    const preview = await chat(token, "I have arrived");
    await Claim.findByIdAndUpdate(rice.id, { status: "CANCELLED" });
    const pulao = await Donation.findOne({ foodName: "Vegetable Pulao" });
    const second = await request(app).post(`/api/donations/${pulao!.id}/claim`).set("Authorization", `Bearer ${token}`).send({ quantity: 5 });
    expect(second.status).toBe(201);
    const before = await assistantNotificationCount();
    expect((await confirmAction(token, preview.pendingActionId)).status).toBe(400);
    expect(await assistantNotificationCount()).toBe(before);
  });

  it("asks for a fresh preview after a pending update expires", async () => {
    const token = await login("helpinghands@foodrescue.demo");
    await claimRice(token);
    const before = await assistantNotificationCount();
    const preview = await chat(token, "I've arrived");
    getPendingAction(preview.pendingActionId)!.expiresAt = Date.now() - 1;
    const reply = await chat(token, "send it", { pendingActionId: preview.pendingActionId });
    expect(reply.reply).toMatch(/new preview/i);
    expect(reply.pendingActionId).toBeFalsy();
    expect(await assistantNotificationCount()).toBe(before);
  });

  it("preserves a negated guard instruction and the named gate through confirmation", async () => {
    const token = await login("helpinghands@foodrescue.demo");
    const claim = await claimRice(token);
    const donor = await login("pratykshgupta9999@gmail.com");
    const message = "Tell the recipient don't collect from the guard. Use the east gate, not the west gate.";
    const preview = await chat(donor, message);
    expect(preview.pendingActionId).toBeTruthy();
    expect(preview.reply).toMatch(/don't collect from the guard/i);
    expect(preview.reply).toMatch(/east gate, not the west gate/i);
    await chat(donor, "confirm", { pendingActionId: preview.pendingActionId });
    const notification = await Notification.findOne({ claimId: claim.id, type: "PICKUP_INSTRUCTIONS_UPDATED" });
    expect(notification!.message).toMatch(/don't collect from the guard/i);
    expect(notification!.message).toMatch(/east gate, not the west gate/i);
  });

  it("does not report a claim alert as a sent assistant update", async () => {
    const token = await login("helpinghands@foodrescue.demo");
    await claimRice(token);
    const reply = await chat(token, "did you notify the donor?");
    expect(reply.reply).toMatch(/haven't sent a pickup notification/i);
  });

  it("does not confirm a qualified yes and allows a real correction", async () => {
    const token = await login("helpinghands@foodrescue.demo");
    await claimRice(token);
    const before = await assistantNotificationCount();
    const first = await chat(token, "I am at the west gate, please come outside");
    const second = await chat(token, "yes, but I am at the east gate instead");
    expect(second.pendingActionId).toBeTruthy();
    expect(second.pendingActionId).not.toBe(first.pendingActionId);
    expect(second.reply).toMatch(/east gate/);
    expect(await assistantNotificationCount()).toBe(before);
  });

  it("withdraws an arrival preview when the user says they have not arrived", async () => {
    const token = await login("helpinghands@foodrescue.demo");
    await claimRice(token);
    const preview = await chat(token, "I've arrived");
    const reply = await chat(token, "I haven't arrived yet");
    expect(reply.pendingActionId).toBeFalsy();
    expect(reply.reply).toMatch(/cleared any pending update/i);
    expect((await confirmAction(token, preview.pendingActionId)).status).toBe(404);
  });

  it("does not convert a question during delay clarification into an estimate", async () => {
    const token = await login("helpinghands@foodrescue.demo");
    await claimRice(token);
    await chat(token, "I'm running late");
    const reply = await chat(token, "What if I am 20 minutes late?");
    expect(reply.pendingActionId).toBeFalsy();
    const answer = await chat(token, "15 minutes");
    expect(answer.pendingActionId).toBeTruthy();
    expect(answer.reply).toMatch(/15 minutes late/i);
  });

});
