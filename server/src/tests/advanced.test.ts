import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { User } from "../models/User.js";
import { Donation } from "../models/Donation.js";
import { Claim } from "../models/Claim.js";
import { ORIGIN, seedDatabase } from "../scripts/seed.js";
import { computeUrgency } from "../services/urgency.js";
import { resetSentMail, sentMail } from "../services/mail.js";

process.env.DEMO_MODE = "false";

const app = createApp();
let mongo: MongoMemoryServer;

async function login(email: string, password = "Demo@123") {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  expect(res.status).toBe(200);
  return res.body.token as string;
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.createIndexes(), Donation.createIndexes(), Claim.createIndexes()]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await seedDatabase();
  resetSentMail();
});

describe("urgency", () => {
  it("treats time remaining as the dominant factor", () => {
    const soonSmall = computeUrgency({
      expiresAt: new Date(Date.now() + 5 * 60_000),
      quantity: 40,
      availableQuantity: 5,
      escalationLevel: 1,
    });
    const laterLarge = computeUrgency({
      expiresAt: new Date(Date.now() + 40 * 60_000),
      quantity: 40,
      availableQuantity: 40,
      escalationLevel: 1,
    });
    expect(soonSmall.score).toBeGreaterThan(laterLarge.score);
    expect(soonSmall.band).toBe("CRITICAL");
    expect(laterLarge.band).toBe("NORMAL");
  });
});

describe("rescue escalation", () => {
  it("expands to 4 km after 20 minutes and lets Distant Aid claim", async () => {
    const donation = await Donation.findOne({ foodName: "Rice + Dal + Vegetables" });
    await Donation.collection.updateOne(
      { _id: donation!._id },
      { $set: { createdAt: new Date(Date.now() - 21 * 60_000) } },
    );

    const donor = await login("pratykshgupta9999@gmail.com");
    const status = await request(app)
      .get(`/api/donations/${donation!.id}/rescue-status`)
      .set("Authorization", `Bearer ${donor}`);
    expect(status.body.escalationLevel).toBe(2);
    expect(status.body.currentRadiusKm).toBe(4);

    const distant = await login("distantaid@foodrescue.demo");
    const nearby = await request(app).get("/api/donations/nearby").set("Authorization", `Bearer ${distant}`);
    const names = nearby.body.donations.map((d: { foodName: string }) => d.foodName);
    expect(names).toContain("Rice + Dal + Vegetables");

    const claim = await request(app)
      .post(`/api/donations/${donation!.id}/claim`)
      .set("Authorization", `Bearer ${distant}`)
      .send({ quantity: 10 });
    expect(claim.status).toBe(201);
    expect(claim.body.donation.availableQuantity).toBe(30);

    const notes = await request(app).get("/api/notifications").set("Authorization", `Bearer ${distant}`);
    expect(
      notes.body.notifications.some(
        (n: { type: string; donationId: string }) =>
          n.type === "RESCUE_EXPANDED" && n.donationId === donation!.id,
      ),
    ).toBe(true);

    const hh = await login("helpinghands@foodrescue.demo");
    const hhNotes = await request(app).get("/api/notifications").set("Authorization", `Bearer ${hh}`);
    expect(
      hhNotes.body.notifications.filter(
        (n: { type: string; donationId: string }) =>
          n.type === "RESCUE_EXPANDED" && n.donationId === donation!.id,
      ),
    ).toHaveLength(0);
  });

  it("reaches Outer Reach Kitchen at 6 km after 40 minutes", async () => {
    const donation = await Donation.findOne({ foodName: "Rice + Dal + Vegetables" });
    await Donation.collection.updateOne(
      { _id: donation!._id },
      { $set: { createdAt: new Date(Date.now() - 41 * 60_000) } },
    );

    const donor = await login("pratykshgupta9999@gmail.com");
    await request(app)
      .get(`/api/donations/${donation!.id}/rescue-status`)
      .set("Authorization", `Bearer ${donor}`);

    const outer = await login("outerreach@foodrescue.demo");
    const nearby = await request(app).get("/api/donations/nearby").set("Authorization", `Bearer ${outer}`);
    const match = nearby.body.donations.find((d: { foodName: string }) => d.foodName === "Rice + Dal + Vegetables");
    expect(match).toBeTruthy();
    expect(match.currentRadiusKm).toBe(6);
    expect(match.escalationLevel).toBe(3);
    expect(match.urgencyLabel).toBe("URGENT RESCUE");

    const notes = await request(app).get("/api/notifications").set("Authorization", `Bearer ${outer}`);
    expect(notes.body.notifications.some((n: { type: string }) => n.type === "URGENT_RESCUE")).toBe(true);
  });

  it("rejects demo-escalate unless DEMO_MODE is enabled", async () => {
    const donation = await Donation.findOne({ foodName: "Rice + Dal + Vegetables" });
    const donor = await login("pratykshgupta9999@gmail.com");
    const res = await request(app)
      .post(`/api/donations/${donation!.id}/demo-escalate`)
      .set("Authorization", `Bearer ${donor}`);
    expect(res.status).toBe(403);
  });
});

describe("donor intelligence", () => {
  it("counts rescued as PICKED_UP only", async () => {
    const loc = ORIGIN;
    const registered = await request(app).post("/api/auth/register").send({
      name: "Analytics Mess",
      email: "analytics@test.demo",
      phone: "9888888888",
      password: "Password1",
      role: "DONOR",
      donorType: "College Mess",
      organizationName: "Analytics Mess",
      address: "Campus",
      location: loc,
    });
    expect(registered.status).toBe(201);
    const verifyUrl = sentMail.at(-1)?.verifyUrl;
    expect(verifyUrl).toBeTruthy();
    const verifyToken = new URL(verifyUrl!).searchParams.get("token");
    const confirmed = await request(app).post("/api/auth/verify-email").send({ token: verifyToken });
    expect(confirmed.status).toBe(200);
    const token = await login("analytics@test.demo", "Password1");
    const created = await request(app)
      .post("/api/donations")
      .set("Authorization", `Bearer ${token}`)
      .send({
        foodName: "Surplus thali",
        description: "Isolated analytics donation.",
        quantity: 40,
        category: "Vegetarian",
        address: "Cafeteria",
        storageCondition: "Covered containers",
        pickupInstructions: "Ask at the desk.",
        location: loc,
        safetyConfirmed: true,
      });
    expect(created.status).toBe(201);
    const donationId = created.body.donation.id as string;

    const hh = await login("helpinghands@foodrescue.demo");
    const picked = await request(app)
      .post(`/api/donations/${donationId}/claim`)
      .set("Authorization", `Bearer ${hh}`)
      .send({ quantity: 7 });
    expect(picked.status).toBe(201);
    const blocked = await request(app)
      .patch(`/api/claims/${picked.body.claim.id}`)
      .set("Authorization", `Bearer ${hh}`)
      .send({ claimCode: picked.body.claim.claimCode });
    expect(blocked.status).toBe(403);
    await request(app)
      .patch(`/api/claims/${picked.body.claim.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ claimCode: picked.body.claim.claimCode });

    const ffa = await login("foodforall@foodrescue.demo");
    const extra = await request(app)
      .post(`/api/donations/${donationId}/claim`)
      .set("Authorization", `Bearer ${ffa}`)
      .send({ quantity: 3 });
    expect(extra.status).toBe(201);
    await Claim.updateOne({ _id: extra.body.claim.id }, { $set: { status: "CANCELLED" } });

    const analytics = await request(app).get("/api/donor/analytics").set("Authorization", `Bearer ${token}`);
    expect(analytics.body.mealsDonated).toBe(40);
    expect(analytics.body.mealsClaimed).toBe(10);
    expect(analytics.body.mealsRescued).toBe(7);
    expect(analytics.body.mealsUnrescued).toBe(33);
  });

  it("detects a Friday evening surplus pattern from seeded history", async () => {
    const donor = await login("pratykshgupta9999@gmail.com");
    const res = await request(app).get("/api/donor/patterns").set("Authorization", `Bearer ${donor}`);
    expect(res.status).toBe(200);
    expect(res.body.ready).toBe(true);
    expect(res.body.insights.some((i: { body: string }) => i.body.includes("recurring pattern"))).toBe(true);
    expect(res.body.insights.some((i: { body: string }) => i.body.toLowerCase().includes("friday"))).toBe(true);
  });
});

describe("operational reliability", () => {
  it("computes different scores from claims and never stores them on User", async () => {
    const admin = await login("admin.sharedtable@gmail.com");
    const res = await request(app).get("/api/admin/reliability").set("Authorization", `Bearer ${admin}`);
    const rows = res.body.recipients as { name: string; score: number | null }[];
    const hh = rows.find((r) => r.name === "Helping Hands NGO");
    const distant = rows.find((r) => r.name === "Distant Aid");
    const outer = rows.find((r) => r.name === "Outer Reach Kitchen");
    expect(hh?.score).toBeGreaterThan(distant?.score ?? 0);
    expect(outer?.score).toBeNull();

    const user = await User.findOne({ email: "helpinghands@foodrescue.demo" });
    expect(user?.toObject()).not.toHaveProperty("reliabilityScore");
    expect(user?.toObject()).not.toHaveProperty("operationalReliability");
  });
});

describe("admin heatmap privacy", () => {
  it("returns snapped coordinates and named areas without user ids", async () => {
    const admin = await login("admin.sharedtable@gmail.com");
    const res = await request(app).get("/api/admin/heatmap?range=30d").set("Authorization", `Bearer ${admin}`);
    expect(res.status).toBe(200);
    expect(res.body.privacy).toMatch(/200 m/);
    expect(res.body.privacy).toMatch(/address|neighborhood/i);
    const live = res.body.live as { lat: number; lng: number; liveStateLabel: string }[];
    expect(live.length).toBeGreaterThan(0);
    expect(live.some((m) => m.liveStateLabel)).toBe(true);
    const exact = live.find((m) => m.lat === ORIGIN.lat && m.lng === ORIGIN.lng);
    expect(exact).toBeUndefined();
    const cell = res.body.cells[0];
    expect(cell.areaId).toBeTruthy();
    expect(cell.placeName).toBeTruthy();
    expect(cell.placeName).not.toMatch(/^\d+\.\d+,\d+\.\d+$/);
    expect(cell).not.toHaveProperty("address");
    expect(cell).not.toHaveProperty("userId");
  });
});

describe("collector heatmap", () => {
  it("returns snapped live markers and named surplus areas for a recipient", async () => {
    const hh = await login("helpinghands@foodrescue.demo");
    const res = await request(app).get("/api/dashboard/recipient").set("Authorization", `Bearer ${hh}`);
    expect(res.status).toBe(200);
    expect(res.body.heatmap.live.length).toBeGreaterThan(0);
    expect(res.body.heatmap.privacy).toMatch(/Approximate area/);
    const payload = JSON.stringify(res.body.heatmap.live);
    expect(payload).not.toMatch(/College Cafeteria, Polaris Campus/);
    const live = res.body.heatmap.live as { lat: number; lng: number; liveState: string }[];
    expect(live.find((m) => m.lat === ORIGIN.lat && m.lng === ORIGIN.lng)).toBeUndefined();
    expect(live.some((m) => m.liveState === "ACTIVE" || m.liveState === "URGENT")).toBe(true);
    expect(live.some((m) => m.liveState === "RESCUED")).toBe(true);

    const areas = res.body.heatmap.surplusAreas as { name: string; meals: number }[];
    expect(areas.map((a) => a.name)).toContain("Campus Cafeteria");
    expect(areas[0].name).toBe("Campus Cafeteria");
    for (let i = 1; i < areas.length; i++) {
      expect(areas[i - 1].meals).toBeGreaterThanOrEqual(areas[i].meals);
    }
    expect(areas.some((a) => a.name === "Koramangala" && a.meals > 0)).toBe(true);
    expect(areas.some((a) => a.name === "HSR" && a.meals > 0)).toBe(true);
    expect(areas.some((a) => a.name === "Indiranagar" && a.meals > 0)).toBe(true);
  });

  it("rejects a donor from the recipient dashboard", async () => {
    const donor = await login("pratykshgupta9999@gmail.com");
    const res = await request(app).get("/api/dashboard/recipient").set("Authorization", `Bearer ${donor}`);
    expect(res.status).toBe(403);
  });
});

describe("claim quantity", () => {
  it("keeps quantity immutable after creation", async () => {
    const donation = await Donation.findOne({ foodName: "Rice + Dal + Vegetables" });
    const hh = await login("helpinghands@foodrescue.demo");
    const claimed = await request(app)
      .post(`/api/donations/${donation!.id}/claim`)
      .set("Authorization", `Bearer ${hh}`)
      .send({ quantity: 10 });
    const claim = await Claim.findById(claimed.body.claim.id);
    claim!.quantity = 99;
    await claim!.save();
    const fresh = await Claim.findById(claim!.id);
    expect(fresh!.quantity).toBe(10);
  });
});
