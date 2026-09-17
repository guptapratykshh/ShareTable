import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { User } from "../models/User.js";
import { Donation } from "../models/Donation.js";
import { Claim } from "../models/Claim.js";
import { Notification } from "../models/Notification.js";
import { destination, ORIGIN, seedDatabase } from "../scripts/seed.js";
import { haversineKm } from "../utils.js";
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
  await Promise.all([User.createIndexes(), Donation.createIndexes()]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await seedDatabase();
  resetSentMail();
});

describe("authentication", () => {
  function lastVerifyToken() {
    const url = sentMail.at(-1)?.verifyUrl;
    expect(url).toBeTruthy();
    return new URL(url!).searchParams.get("token");
  }

  const newDonor = {
    name: "New Mess",
    email: "newmess@test.demo",
    phone: "9999999999",
    password: "Password1",
    role: "DONOR",
    donorType: "Restaurant",
    organizationName: "New Mess",
    address: "Nearby",
    location: destination(ORIGIN.lat, ORIGIN.lng, 0.2, 10),
  };

  it("registers a donor without logging them in until the email is verified", async () => {
    const res = await request(app).post("/api/auth/register").send(newDonor);
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.token).toBeUndefined();
    expect(sentMail.at(-1)?.to).toBe("newmess@test.demo");
    expect(sentMail.at(-1)?.verifyUrl).toMatch(/\/verify-email\?token=/);

    const blocked = await request(app)
      .post("/api/auth/login")
      .send({ email: newDonor.email, password: newDonor.password });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error).toMatch(/verify your email/i);

    const verified = await request(app).post("/api/auth/verify-email").send({ token: lastVerifyToken() });
    expect(verified.status).toBe(200);

    const token = await login(newDonor.email, newDonor.password);
    const forbidden = await request(app)
      .get("/api/dashboard/admin")
      .set("Authorization", `Bearer ${token}`);
    expect(forbidden.status).toBe(403);
  });

  it("rejects a bad or expired verification token", async () => {
    const res = await request(app).post("/api/auth/register").send(newDonor);
    expect(res.status).toBe(201);
    const token = lastVerifyToken();

    const bad = await request(app).post("/api/auth/verify-email").send({ token: "a".repeat(32) });
    expect(bad.status).toBe(400);

    const user = await User.findOne({ email: newDonor.email });
    user!.emailVerifyExpires = new Date(Date.now() - 1000);
    await user!.save();

    const expired = await request(app).post("/api/auth/verify-email").send({ token });
    expect(expired.status).toBe(400);

    const stillBlocked = await request(app)
      .post("/api/auth/login")
      .send({ email: newDonor.email, password: newDonor.password });
    expect(stillBlocked.status).toBe(403);
  });

  it("lets demo accounts log in without email verification", async () => {
    for (const email of ["mess@foodrescue.demo", "helpinghands@foodrescue.demo", "admin@foodrescue.demo"]) {
      const user = await User.findOne({ email });
      user!.emailVerified = false;
      await user!.save();
      const token = await login(email);
      const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
      expect(me.status).toBe(200);
      expect(me.body.user.email).toBe(email);
    }
  });

  it("logs in seeded users and blocks unauthenticated access", async () => {
    const token = await login("mess@foodrescue.demo");
    expect(token).toBeTruthy();
    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(me.body.user.organizationName).toBe("Polaris College Mess");
    const unauth = await request(app).get("/api/auth/me");
    expect(unauth.status).toBe(401);
  });

  it("lets admin flag a user so they cannot log in or use the API", async () => {
    const recipient = await login("helpinghands@foodrescue.demo");
    const admin = await login("admin@foodrescue.demo");
    const target = await User.findOne({ email: "helpinghands@foodrescue.demo" });

    const flagged = await request(app)
      .patch(`/api/admin/users/${target!.id}`)
      .set("Authorization", `Bearer ${admin}`)
      .send({ isFlagged: true });
    expect(flagged.status).toBe(200);
    expect(flagged.body.user.isFlagged).toBe(true);

    const blockedLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "helpinghands@foodrescue.demo", password: "Demo@123" });
    expect(blockedLogin.status).toBe(403);
    expect(blockedLogin.body.error).toMatch(/restricted/);

    const blockedSession = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${recipient}`);
    expect(blockedSession.status).toBe(403);

    await request(app)
      .patch(`/api/admin/users/${target!.id}`)
      .set("Authorization", `Bearer ${admin}`)
      .send({ isFlagged: false });
    const restored = await login("helpinghands@foodrescue.demo");
    expect(restored).toBeTruthy();
  });
});

describe("donations", () => {
  it("creates a donation with a 1-hour expiry and notifies nearby recipients only", async () => {
    const token = await login("mess@foodrescue.demo");
    const res = await request(app)
      .post("/api/donations")
      .set("Authorization", `Bearer ${token}`)
      .send({
        foodName: "Rice + Dal + Vegetables",
        description: "Evening surplus from the college mess.",
        quantity: 40,
        category: "Vegetarian",
        address: "College Cafeteria",
        pickupInstructions: "West gate",
        location: ORIGIN,
        safetyConfirmed: true,
      });
    expect(res.status).toBe(201);
    expect(res.body.notifiedRecipientCount).toBe(3);
    expect(res.body.nearbyRecipients.map((r: { name: string }) => r.name).sort()).toEqual(
      ["Community Care", "Food For All", "Helping Hands NGO"].sort(),
    );
    const expires = new Date(res.body.donation.expiresAt).getTime();
    expect(expires - Date.now()).toBeGreaterThan(55 * 60 * 1000);
    expect(expires - Date.now()).toBeLessThan(61 * 60 * 1000);

    const hh = await login("helpinghands@foodrescue.demo");
    const notes = await request(app).get("/api/notifications").set("Authorization", `Bearer ${hh}`);
    expect(notes.body.notifications.some((n: { type: string }) => n.type === "NEW_DONATION")).toBe(true);

    const far = await login("distantaid@foodrescue.demo");
    const farNotes = await request(app).get("/api/notifications").set("Authorization", `Bearer ${far}`);
    expect(farNotes.body.notifications.filter((n: { donationId: string }) => n.donationId === res.body.donation.id)).toHaveLength(0);
  });

  it("stores declared allergens and shows them before a claim", async () => {
    const token = await login("mess@foodrescue.demo");
    const created = await request(app)
      .post("/api/donations")
      .set("Authorization", `Bearer ${token}`)
      .send({
        foodName: "Peanut chutney rice",
        description: "Leftover rice with peanut chutney.",
        quantity: 12,
        category: "Vegetarian",
        address: "College Cafeteria",
        pickupInstructions: "West gate",
        location: ORIGIN,
        safetyConfirmed: true,
        allergens: ["Peanuts", "Cashew masala", "Peanuts"],
      });
    expect(created.status).toBe(201);
    expect(created.body.donation.allergens).toEqual(["Peanuts", "Cashew masala"]);

    const hh = await login("helpinghands@foodrescue.demo");
    const nearby = await request(app).get("/api/donations/nearby").set("Authorization", `Bearer ${hh}`);
    const card = nearby.body.donations.find((d: { foodName: string }) => d.foodName === "Peanut chutney rice");
    expect(card).toBeTruthy();
    expect(card.allergens).toEqual(["Peanuts", "Cashew masala"]);
    expect(card.address).toBeUndefined();

    const detail = await request(app)
      .get(`/api/donations/${created.body.donation.id}`)
      .set("Authorization", `Bearer ${hh}`);
    expect(detail.status).toBe(200);
    expect(detail.body.donation.allergens).toEqual(["Peanuts", "Cashew masala"]);
    expect(detail.body.donation.address).toBeUndefined();
  });

  it("marks every notification read for the current user", async () => {
    const token = await login("mess@foodrescue.demo");
    await request(app)
      .post("/api/donations")
      .set("Authorization", `Bearer ${token}`)
      .send({
        foodName: "Rice + Dal + Vegetables",
        description: "Evening surplus from the college mess.",
        quantity: 40,
        category: "Vegetarian",
        address: "College Cafeteria",
        pickupInstructions: "West gate",
        location: ORIGIN,
        safetyConfirmed: true,
      });

    const hh = await login("helpinghands@foodrescue.demo");
    const before = await request(app).get("/api/notifications").set("Authorization", `Bearer ${hh}`);
    expect(before.body.unreadCount).toBeGreaterThan(0);

    const marked = await request(app).patch("/api/notifications/read-all").set("Authorization", `Bearer ${hh}`);
    expect(marked.status).toBe(200);

    const after = await request(app).get("/api/notifications").set("Authorization", `Bearer ${hh}`);
    expect(after.body.unreadCount).toBe(0);
    expect(after.body.notifications.every((n: { isRead: boolean }) => n.isRead)).toBe(true);
  });

  it("rejects invalid quantity and missing safety confirmation", async () => {
    const token = await login("mess@foodrescue.demo");
    const badQty = await request(app)
      .post("/api/donations")
      .set("Authorization", `Bearer ${token}`)
      .send({
        foodName: "Rice",
        description: "Leftover rice",
        quantity: 0,
        category: "Other",
        address: "Cafeteria",
        location: ORIGIN,
        safetyConfirmed: true,
      });
    expect(badQty.status).toBe(400);

    const noSafety = await request(app)
      .post("/api/donations")
      .set("Authorization", `Bearer ${token}`)
      .send({
        foodName: "Rice",
        description: "Leftover rice",
        quantity: 10,
        category: "Other",
        address: "Cafeteria",
        location: ORIGIN,
        safetyConfirmed: false,
      });
    expect(noSafety.status).toBe(400);
  });
});

describe("geolocation", () => {
  it("includes recipients inside 2.5 km and excludes those outside", async () => {
    const token = await login("helpinghands@foodrescue.demo");
    const res = await request(app).get("/api/donations/nearby").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const names = res.body.donations.map((d: { foodName: string }) => d.foodName);
    expect(names).toContain("Rice + Dal + Vegetables");
    expect(names).toContain("Vegetable Pulao");
    expect(names).not.toContain("Bakery buns");
    expect(res.body.donations[0].location).toBeUndefined();
  });
});

describe("claims", () => {
  it("claims a valid quantity and rejects over-claiming", async () => {
    const donation = await Donation.findOne({ foodName: "Rice + Dal + Vegetables" });
    const token = await login("helpinghands@foodrescue.demo");
    const ok = await request(app)
      .post(`/api/donations/${donation!.id}/claim`)
      .set("Authorization", `Bearer ${token}`)
      .send({ quantity: 10 });
    expect(ok.status).toBe(201);
    expect(ok.body.donation.availableQuantity).toBe(30);
    expect(ok.body.claim.claimCode).toMatch(/^ST-\d{4}$/);

    const tooMany = await request(app)
      .post(`/api/donations/${donation!.id}/claim`)
      .set("Authorization", `Bearer ${token}`)
      .send({ quantity: 40 });
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.error).toMatch(/already have a reservation/);

    const other = await login("foodforall@foodrescue.demo");
    const over = await request(app)
      .post(`/api/donations/${donation!.id}/claim`)
      .set("Authorization", `Bearer ${other}`)
      .send({ quantity: 40 });
    expect(over.status).toBe(400);
    expect(over.body.error).toMatch(/Only 30 meals remain/);
  });

  it("does not allow availableQuantity to go negative under concurrent claims", async () => {
    const donation = await Donation.findOne({ foodName: "Rice + Dal + Vegetables" });
    const a = await login("helpinghands@foodrescue.demo");
    const b = await login("foodforall@foodrescue.demo");
    const [ra, rb] = await Promise.all([
      request(app).post(`/api/donations/${donation!.id}/claim`).set("Authorization", `Bearer ${a}`).send({ quantity: 30 }),
      request(app).post(`/api/donations/${donation!.id}/claim`).set("Authorization", `Bearer ${b}`).send({ quantity: 20 }),
    ]);
    const statuses = [ra.status, rb.status].sort();
    expect(statuses).toEqual([201, 400]);
    const loser = ra.status === 400 ? ra : rb;
    expect(loser.body.error).toMatch(/Only \d+ meals remain\. Another recipient claimed some meals just before you\./);
    const fresh = await Donation.findById(donation!.id);
    expect(fresh!.availableQuantity).toBeGreaterThanOrEqual(0);
    expect(fresh!.availableQuantity).toBe(10);
  });

  it("blocks a second reservation until pickup, then allows leftover meals", async () => {
    const donation = await Donation.findOne({ foodName: "Rice + Dal + Vegetables" });
    const hh = await login("helpinghands@foodrescue.demo");
    const first = await request(app)
      .post(`/api/donations/${donation!.id}/claim`)
      .set("Authorization", `Bearer ${hh}`)
      .send({ quantity: 10 });
    expect(first.status).toBe(201);

    const blocked = await request(app)
      .post(`/api/donations/${donation!.id}/claim`)
      .set("Authorization", `Bearer ${hh}`)
      .send({ quantity: 5 });
    expect(blocked.status).toBe(400);
    expect(blocked.body.error).toMatch(/already have a reservation/);

    const donor = await login("mess@foodrescue.demo");
    const confirmed = await request(app)
      .patch(`/api/claims/${first.body.claim.id}`)
      .set("Authorization", `Bearer ${donor}`)
      .send({ claimCode: first.body.claim.claimCode });
    expect(confirmed.body.claim.status).toBe("PICKED_UP");

    const remainder = await request(app)
      .post(`/api/donations/${donation!.id}/claim`)
      .set("Authorization", `Bearer ${hh}`)
      .send({ quantity: 5 });
    expect(remainder.status).toBe(201);
    expect(remainder.body.claim.quantity).toBe(5);
    expect(remainder.body.donation.availableQuantity).toBe(25);
    const original = await Claim.findById(first.body.claim.id);
    expect(original!.quantity).toBe(10);
  });

  it("hides the pickup code from the donor until they enter what the collector shows", async () => {
    const donation = await Donation.findOne({ foodName: "Rice + Dal + Vegetables" });
    const hh = await login("helpinghands@foodrescue.demo");
    const created = await request(app)
      .post(`/api/donations/${donation!.id}/claim`)
      .set("Authorization", `Bearer ${hh}`)
      .send({ quantity: 10 });
    expect(created.body.claim.claimCode).toMatch(/^ST-\d{4}$/);
    const secret = created.body.claim.claimCode as string;

    const donor = await login("mess@foodrescue.demo");
    const pending = await request(app)
      .get(`/api/claims/${created.body.claim.id}`)
      .set("Authorization", `Bearer ${donor}`);
    expect(pending.status).toBe(200);
    expect(pending.body.claim.claimCode).toBeUndefined();

    const wrong = await request(app)
      .patch(`/api/claims/${created.body.claim.id}`)
      .set("Authorization", `Bearer ${donor}`)
      .send({ claimCode: "ST-0000" });
    expect(wrong.status).toBe(400);

    const ok = await request(app)
      .patch(`/api/claims/${created.body.claim.id}`)
      .set("Authorization", `Bearer ${donor}`)
      .send({ claimCode: secret });
    expect(ok.status).toBe(200);
    expect(ok.body.claim.status).toBe("PICKED_UP");
    expect(ok.body.claim.claimCode).toBe(secret);
  });

  it("rejects claims on expired donations", async () => {
    const donation = await Donation.findOne({ foodName: "Rice + Dal + Vegetables" });
    donation!.expiresAt = new Date(Date.now() - 1000);
    await donation!.save();
    const token = await login("helpinghands@foodrescue.demo");
    const res = await request(app)
      .post(`/api/donations/${donation!.id}/claim`)
      .set("Authorization", `Bearer ${token}`)
      .send({ quantity: 5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Donation has expired.");
    const fresh = await Donation.findById(donation!.id);
    expect(fresh!.status).toBe("EXPIRED");
  });

  it("notifies recipients when a donor cancels a listing", async () => {
    const donation = await Donation.findOne({ foodName: "Rice + Dal + Vegetables" });
    const hh = await login("helpinghands@foodrescue.demo");
    await request(app)
      .post(`/api/donations/${donation!.id}/claim`)
      .set("Authorization", `Bearer ${hh}`)
      .send({ quantity: 10 });

    const donor = await login("mess@foodrescue.demo");
    const cancelled = await request(app)
      .patch(`/api/donations/${donation!.id}`)
      .set("Authorization", `Bearer ${donor}`)
      .send({ status: "CANCELLED" });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.donation.status).toBe("CANCELLED");

    const notes = await request(app).get("/api/notifications").set("Authorization", `Bearer ${hh}`);
    const cancelledNote = notes.body.notifications.find((n: { type: string }) => n.type === "DONATION_CANCELLED");
    expect(cancelledNote).toBeTruthy();
    expect(cancelledNote.message).toMatch(/reservation is no longer available/);
    expect(cancelledNote.message).not.toMatch(/\b(?:ST|FR)-\d{4}\b/);

    const ffa = await login("foodforall@foodrescue.demo");
    const nearbyNotes = await request(app).get("/api/notifications").set("Authorization", `Bearer ${ffa}`);
    expect(nearbyNotes.body.notifications.some((n: { type: string }) => n.type === "DONATION_CANCELLED")).toBe(true);
  });

  it("lets a donor remove an expired unused listing and blocks active ones", async () => {
    const donation = await Donation.findOne({ foodName: "Rice + Dal + Vegetables" });
    const donor = await login("mess@foodrescue.demo");

    const blocked = await request(app)
      .delete(`/api/donations/${donation!.id}`)
      .set("Authorization", `Bearer ${donor}`);
    expect(blocked.status).toBe(400);

    donation!.expiresAt = new Date(Date.now() - 1000);
    donation!.status = "EXPIRED";
    await donation!.save();

    const removed = await request(app)
      .delete(`/api/donations/${donation!.id}`)
      .set("Authorization", `Bearer ${donor}`);
    expect(removed.status).toBe(200);
    expect(removed.body.ok).toBe(true);
    expect(await Donation.findById(donation!.id)).toBeNull();
  });
});

describe("dashboard impact", () => {
  it("counts only PICKED_UP meals as rescued and ignores expired leftovers", async () => {
    const donation = await Donation.findOne({ foodName: "Rice + Dal + Vegetables" });
    const hh = await login("helpinghands@foodrescue.demo");
    const claimed = await request(app)
      .post(`/api/donations/${donation!.id}/claim`)
      .set("Authorization", `Bearer ${hh}`)
      .send({ quantity: 10 });
    const blocked = await request(app)
      .patch(`/api/claims/${claimed.body.claim.id}`)
      .set("Authorization", `Bearer ${hh}`)
      .send({ claimCode: claimed.body.claim.claimCode });
    expect(blocked.status).toBe(403);

    const donor = await login("mess@foodrescue.demo");
    const confirmed = await request(app)
      .patch(`/api/claims/${claimed.body.claim.id}`)
      .set("Authorization", `Bearer ${donor}`)
      .send({ claimCode: claimed.body.claim.claimCode });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.claim.status).toBe("PICKED_UP");

    const admin = await login("admin@foodrescue.demo");
    const dashBefore = await request(app).get("/api/dashboard/admin").set("Authorization", `Bearer ${admin}`);
    const rescuedBefore = dashBefore.body.mealsRescued as number;

    const leftover = await Donation.findById(donation!.id);
    leftover!.expiresAt = new Date(Date.now() - 1000);
    leftover!.status = "PARTIALLY_CLAIMED";
    await leftover!.save();

    const dash = await request(app).get("/api/dashboard/admin").set("Authorization", `Bearer ${admin}`);
    expect(dash.body.mealsRescued).toBe(rescuedBefore);
    expect(dash.body.rescueRate).toBeGreaterThan(0);
    const expired = await Donation.findById(donation!.id);
    expect(expired!.status).toBe("EXPIRED");
    expect(expired!.availableQuantity).toBe(30);
    const picked = await Claim.find({ donationId: donation!._id, status: "PICKED_UP" });
    expect(picked.reduce((s, c) => s + c.quantity, 0)).toBe(10);
  });
});

describe("public impact", () => {
  it("returns live rescued totals without auth", async () => {
    const res = await request(app).get("/api/impact");
    expect(res.status).toBe(200);
    expect(res.body.mealsRescued).toBeGreaterThan(0);
    expect(res.body.totalDonors).toBeGreaterThan(0);
    expect(res.body.totalNgos).toBeGreaterThan(0);
    expect(res.body.defaultRadiusKm).toBe(2.5);
    expect(res.body.listingWindowHours).toBe(1);

    const admin = await login("admin@foodrescue.demo");
    const dash = await request(app).get("/api/dashboard/admin").set("Authorization", `Bearer ${admin}`);
    expect(res.body.mealsRescued).toBe(dash.body.mealsRescued);
    expect(res.body.totalDonors).toBe(dash.body.totalDonors);
    expect(res.body.totalNgos).toBe(dash.body.totalNgos);
  });
});

describe("geo helper", () => {
  it("places Distant Aid outside 2.5 km of origin", () => {
    const far = destination(ORIGIN.lat, ORIGIN.lng, 3.8, 180);
    const d = haversineKm(ORIGIN.lng, ORIGIN.lat, far.lng, far.lat);
    expect(d).toBeGreaterThan(2.5);
    expect(d).toBeLessThan(4.1);
  });
});
