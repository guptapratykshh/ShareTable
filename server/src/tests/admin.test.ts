import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { User } from "../models/User.js";
import { Donation } from "../models/Donation.js";
import { Claim } from "../models/Claim.js";
import { ORIGIN, seedDatabase } from "../scripts/seed.js";

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
});

const kitchenBody = {
  name: "Admin Test Kitchen",
  email: "admintestkitchen@foodrescue.demo",
  phone: "9999900001",
  password: "Demo@1234",
  role: "DONOR",
  organizationName: "Admin Test Kitchen",
  donorType: "Restaurant",
  address: "Test kitchen, Bengaluru",
  location: ORIGIN,
};

const listingBody = {
  foodName: "Admin test meals",
  description: "Created from the admin console for tests.",
  quantity: 12,
  category: "Vegetarian",
  address: "College Cafeteria, Polaris Campus",
  pickupInstructions: "Ask at the desk.",
  location: ORIGIN,
  safetyConfirmed: true,
};

describe("admin console", () => {
  it("blocks donors from admin routes", async () => {
    const donor = await login("mess@foodrescue.demo");
    const res = await request(app).get("/api/admin/users").set("Authorization", `Bearer ${donor}`);
    expect(res.status).toBe(403);
  });

  it("creates, updates, and deletes a kitchen without rescued meals", async () => {
    const admin = await login("admin@foodrescue.demo");
    const created = await request(app).post("/api/admin/users").set("Authorization", `Bearer ${admin}`).send(kitchenBody);
    expect(created.status).toBe(201);
    expect(created.body.user.role).toBe("DONOR");
    expect(created.body.user.emailVerified).toBe(true);
    const id = created.body.user.id as string;

    const detail = await request(app).get(`/api/admin/users/${id}`).set("Authorization", `Bearer ${admin}`);
    expect(detail.status).toBe(200);
    expect(detail.body.user.organizationName).toBe("Admin Test Kitchen");
    expect(detail.body.donations).toEqual([]);

    const updated = await request(app)
      .put(`/api/admin/users/${id}`)
      .set("Authorization", `Bearer ${admin}`)
      .send({ ...kitchenBody, name: "Renamed Kitchen", password: undefined });
    expect(updated.status).toBe(200);
    expect(updated.body.user.name).toBe("Renamed Kitchen");

    const removed = await request(app).delete(`/api/admin/users/${id}`).set("Authorization", `Bearer ${admin}`);
    expect(removed.status).toBe(200);
    expect(removed.body.ok).toBe(true);
  });

  it("blocks deleting a collector with rescued meals", async () => {
    const admin = await login("admin@foodrescue.demo");
    const target = await User.findOne({ email: "helpinghands@foodrescue.demo" });
    const res = await request(app).delete(`/api/admin/users/${target!.id}`).set("Authorization", `Bearer ${admin}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/rescued meals/);
  });

  it("creates, edits, and deletes a listing without pickups", async () => {
    const admin = await login("admin@foodrescue.demo");
    const donor = await User.findOne({ email: "mess@foodrescue.demo" });
    const created = await request(app)
      .post("/api/admin/donations")
      .set("Authorization", `Bearer ${admin}`)
      .send({ ...listingBody, donorId: donor!.id });
    expect(created.status).toBe(201);
    const id = created.body.donation.id as string;
    expect(created.body.donation.address).toBe(listingBody.address);

    const patched = await request(app)
      .put(`/api/admin/donations/${id}`)
      .set("Authorization", `Bearer ${admin}`)
      .send({ foodName: "Renamed meals", address: "Staff canteen annex" });
    expect(patched.status).toBe(200);
    expect(patched.body.donation.foodName).toBe("Renamed meals");
    expect(patched.body.donation.quantity).toBe(12);

    const removed = await request(app).delete(`/api/admin/donations/${id}`).set("Authorization", `Bearer ${admin}`);
    expect(removed.status).toBe(200);
  });

  it("blocks deleting a listing with recorded pickups", async () => {
    const admin = await login("admin@foodrescue.demo");
    const rescued = await Donation.findOne({ status: "COMPLETED" });
    const res = await request(app).delete(`/api/admin/donations/${rescued!.id}`).set("Authorization", `Bearer ${admin}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/recorded pickups/);
  });

  it("creates a claim, shows the pickup code on detail, and blocks picked-up delete", async () => {
    const admin = await login("admin@foodrescue.demo");
    const donor = await User.findOne({ email: "mess@foodrescue.demo" });
    const recipient = await User.findOne({ email: "helpinghands@foodrescue.demo" });
    const listing = await request(app)
      .post("/api/admin/donations")
      .set("Authorization", `Bearer ${admin}`)
      .send({ ...listingBody, donorId: donor!.id });
    const donationId = listing.body.donation.id as string;

    const created = await request(app)
      .post("/api/admin/claims")
      .set("Authorization", `Bearer ${admin}`)
      .send({ donationId, recipientId: recipient!.id, quantity: 4 });
    expect(created.status).toBe(201);
    expect(created.body.claim.claimCode).toMatch(/^ST-/);
    const claimId = created.body.claim.id as string;

    const list = await request(app).get("/api/admin/claims").set("Authorization", `Bearer ${admin}`);
    const listed = list.body.claims.find((c: { id: string }) => c.id === claimId);
    expect(listed).toBeTruthy();
    expect(listed.claimCode).toBeUndefined();

    const detail = await request(app).get(`/api/admin/claims/${claimId}`).set("Authorization", `Bearer ${admin}`);
    expect(detail.body.claim.claimCode).toBe(created.body.claim.claimCode);

    const edited = await request(app)
      .put(`/api/admin/claims/${claimId}`)
      .set("Authorization", `Bearer ${admin}`)
      .send({ quantity: 3 });
    expect(edited.status).toBe(200);
    expect(edited.body.claim.quantity).toBe(3);

    const openDelete = await request(app).delete(`/api/admin/claims/${claimId}`).set("Authorization", `Bearer ${admin}`);
    expect(openDelete.status).toBe(200);

    const picked = await Claim.findOne({ status: "PICKED_UP" });
    const blocked = await request(app).delete(`/api/admin/claims/${picked!.id}`).set("Authorization", `Bearer ${admin}`);
    expect(blocked.status).toBe(400);
    expect(blocked.body.error).toMatch(/Picked-up/);
  });
});
