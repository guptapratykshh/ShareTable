import bcrypt from "bcryptjs";
import type { Types } from "mongoose";
import { User } from "../models/User.js";
import { Donation } from "../models/Donation.js";
import { Claim } from "../models/Claim.js";
import { Notification } from "../models/Notification.js";
import { point, generatePickupCode } from "../utils.js";
import { SURPLUS_AREAS } from "../services/heatmap.js";

/** Polaris College Mess, Bengaluru demo origin */
export const ORIGIN = { lat: 12.9352, lng: 77.6245 };

const R = 6371;

export function destination(lat: number, lng: number, km: number, bearingDeg: number) {
  const br = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(km / R) + Math.cos(lat1) * Math.sin(km / R) * Math.cos(br),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(br) * Math.sin(km / R) * Math.cos(lat1),
      Math.cos(km / R) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
}

const DEMO_PASSWORD = "Demo@123";

export async function seedDatabase() {
  await Promise.all([
    User.deleteMany({}),
    Donation.deleteMany({}),
    Claim.deleteMany({}),
    Notification.deleteMany({}),
  ]);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const hh = destination(ORIGIN.lat, ORIGIN.lng, 1.1, 0);
  const ffa = destination(ORIGIN.lat, ORIGIN.lng, 1.8, 90);
  const care = destination(ORIGIN.lat, ORIGIN.lng, 2.3, 45);
  const distant = destination(ORIGIN.lat, ORIGIN.lng, 3.8, 180);
  const outer = destination(ORIGIN.lat, ORIGIN.lng, 5.2, 270);

  const [donor, helpingHands, foodForAll, communityCare, distantAid, outerReach, admin] = await User.create([
    {
      name: "Campus Manager",
      email: "pratykshgupta9999@gmail.com",
      phone: "+91 90000 00001",
      passwordHash,
      role: "DONOR",
      organizationName: "Polaris College Mess",
      donorType: "College Mess",
      address: "College Cafeteria, Polaris Campus, Bengaluru",
      location: point(ORIGIN.lng, ORIGIN.lat),
      isVerified: true,
      emailVerified: true,
    },
    {
      name: "Ananya Rao",
      email: "helpinghands@foodrescue.demo",
      phone: "+91 90000 00002",
      passwordHash,
      role: "RECIPIENT",
      organizationName: "Helping Hands NGO",
      recipientType: "NGO",
      address: "1.1 km north of Polaris Campus",
      location: point(hh.lng, hh.lat),
      isVerified: true,
      emailVerified: true,
    },
    {
      name: "Rahul Menon",
      email: "foodforall@foodrescue.demo",
      phone: "+91 90000 00003",
      passwordHash,
      role: "RECIPIENT",
      organizationName: "Food For All",
      recipientType: "Community Organization",
      address: "1.8 km east of Polaris Campus",
      location: point(ffa.lng, ffa.lat),
      isVerified: true,
      emailVerified: true,
    },
    {
      name: "Meera Iyer",
      email: "communitycare@foodrescue.demo",
      phone: "+91 90000 00004",
      passwordHash,
      role: "RECIPIENT",
      organizationName: "Community Care",
      recipientType: "Individual Recipient",
      address: "2.3 km northeast of Polaris Campus",
      location: point(care.lng, care.lat),
      isVerified: true,
      emailVerified: true,
    },
    {
      name: "Arun Patel",
      email: "distantaid@foodrescue.demo",
      phone: "+91 90000 00005",
      passwordHash,
      role: "RECIPIENT",
      organizationName: "Distant Aid",
      recipientType: "NGO",
      address: "3.8 km south of Polaris Campus",
      location: point(distant.lng, distant.lat),
      isVerified: true,
      emailVerified: true,
    },
    {
      name: "Kavya Nair",
      email: "outerreach@foodrescue.demo",
      phone: "+91 90000 00006",
      passwordHash,
      role: "RECIPIENT",
      organizationName: "Outer Reach Kitchen",
      recipientType: "Community Organization",
      address: "5.2 km west of Polaris Campus",
      location: point(outer.lng, outer.lat),
      isVerified: true,
      emailVerified: true,
    },
    {
      name: "ShareTable Admin",
      email: "admin.sharedtable@gmail.com",
      phone: "+91 90000 00009",
      passwordHash,
      role: "ADMIN",
      organizationName: "ShareTable",
      address: "Operations desk",
      location: point(ORIGIN.lng, ORIGIN.lat),
      isVerified: true,
      emailVerified: true,
    },
  ]);

  const now = Date.now();
  const donationBLoc = destination(hh.lat, hh.lng, 1.8, 90);
  const donationCLoc = destination(hh.lat, hh.lng, 3.4, 270);

  const [donationA] = await Donation.create([
    {
      donorId: donor._id,
      foodName: "Rice + Dal + Vegetables",
      description: "Freshly prepared vegetarian thali from the evening mess service.",
      category: "Vegetarian",
      quantity: 40,
      availableQuantity: 40,
      createdAt: new Date(now - 15 * 60 * 1000),
      expiresAt: new Date(now + 45 * 60 * 1000),
      location: point(ORIGIN.lng, ORIGIN.lat),
      address: "College Cafeteria, Polaris Campus",
      pickupInstructions: "Enter from the west gate. Ask for the mess supervisor.",
      allergens: ["Peanuts"],
      status: "ACTIVE",
      safetyConfirmed: true,
      notifiedRecipientCount: 3,
      escalationLevel: 1,
      currentRadiusKm: 2.5,
      notifiedRecipients: [
        { recipientId: helpingHands._id, level: 1, notifiedAt: new Date(now - 15 * 60 * 1000) },
        { recipientId: foodForAll._id, level: 1, notifiedAt: new Date(now - 15 * 60 * 1000) },
        { recipientId: communityCare._id, level: 1, notifiedAt: new Date(now - 15 * 60 * 1000) },
      ],
      storageCondition: "Kept covered in insulated containers",
    },
    {
      donorId: donor._id,
      foodName: "Vegetable Pulao",
      description: "Mildly spiced rice with mixed vegetables from lunch leftover.",
      category: "Rice/Grains",
      quantity: 25,
      availableQuantity: 25,
      createdAt: new Date(now - 38 * 60 * 1000),
      expiresAt: new Date(now + 22 * 60 * 1000),
      location: point(donationBLoc.lng, donationBLoc.lat),
      address: "Staff canteen annex",
      pickupInstructions: "Collect from the annex kitchen window.",
      status: "ACTIVE",
      safetyConfirmed: true,
      notifiedRecipientCount: 2,
      escalationLevel: 1,
      currentRadiusKm: 2.5,
    },
    {
      donorId: donor._id,
      foodName: "Bakery buns",
      description: "Assorted unsold buns from the campus bakery.",
      category: "Bread/Bakery",
      quantity: 15,
      availableQuantity: 15,
      createdAt: new Date(now - 10 * 60 * 1000),
      expiresAt: new Date(now + 50 * 60 * 1000),
      location: point(donationCLoc.lng, donationCLoc.lat),
      address: "Off-campus bakery partner, 3.4 km away",
      pickupInstructions: "Too far for the 2.5 km demo radius.",
      status: "ACTIVE",
      safetyConfirmed: true,
      notifiedRecipientCount: 0,
      escalationLevel: 1,
      currentRadiusKm: 2.5,
    },
  ]);

  await Notification.insertMany([
    {
      recipientId: helpingHands._id,
      type: "NEW_DONATION",
      title: "New food donation nearby",
      message: "40 meals available\nFood: Rice + Dal + Vegetables\nDistance: 1.1 km\nPickup: available for the next 1 hour",
      donationId: donationA._id,
    },
    {
      recipientId: foodForAll._id,
      type: "NEW_DONATION",
      title: "New food donation nearby",
      message: "40 meals available\nFood: Rice + Dal + Vegetables\nDistance: 1.8 km\nPickup: available for the next 1 hour",
      donationId: donationA._id,
    },
    {
      recipientId: communityCare._id,
      type: "NEW_DONATION",
      title: "New food donation nearby",
      message: "40 meals available\nFood: Rice + Dal + Vegetables\nDistance: 2.3 km\nPickup: available for the next 1 hour",
      donationId: donationA._id,
    },
  ]);

  await seedHistoricalPatterns(donor, helpingHands, foodForAll, communityCare, distantAid);

  await User.createIndexes();
  await Donation.createIndexes();
  await Claim.createIndexes();

  return {
    donor,
    helpingHands,
    foodForAll,
    communityCare,
    distantAid,
    outerReach,
    admin,
  };
}

function lastWeekdays(day: number, count: number, hour: number) {
  const out: Date[] = [];
  const cursor = new Date();
  cursor.setHours(hour, 0, 0, 0);
  while (out.length < count) {
    if (cursor.getDay() === day && cursor.getTime() < Date.now() - 2 * 86400000) {
      out.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return out;
}

function daysAgo(days: number, hour: number) {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

async function seedHistoricalPatterns(
  donor: { _id: Types.ObjectId },
  helpingHands: { _id: Types.ObjectId },
  foodForAll: { _id: Types.ObjectId },
  communityCare: { _id: Types.ObjectId },
  distantAid: { _id: Types.ObjectId },
) {
  const fridays = lastWeekdays(5, 6, 18);
  const tuesdays = lastWeekdays(2, 4, 13);
  const historical = [];
  for (const createdAt of fridays) {
    historical.push({
      donorId: donor._id,
      foodName: "Friday rice surplus",
      description: "Demo Data: recorded Friday evening surplus from the mess.",
      category: "Rice/Grains",
      quantity: 34,
      availableQuantity: 0,
      preparedAt: createdAt,
      createdAt,
      expiresAt: new Date(createdAt.getTime() + 60 * 60 * 1000),
      location: point(ORIGIN.lng, ORIGIN.lat),
      address: "College Cafeteria, Polaris Campus",
      status: "COMPLETED",
      safetyConfirmed: true,
      notifiedRecipientCount: 3,
      escalationLevel: 1,
      currentRadiusKm: 2.5,
    });
  }
  for (const createdAt of tuesdays) {
    historical.push({
      donorId: donor._id,
      foodName: "Midweek leftover",
      description: "Demo Data: typical weekday surplus.",
      category: "Vegetarian",
      quantity: 12,
      availableQuantity: 0,
      preparedAt: createdAt,
      createdAt,
      expiresAt: new Date(createdAt.getTime() + 60 * 60 * 1000),
      location: point(ORIGIN.lng, ORIGIN.lat),
      address: "College Cafeteria, Polaris Campus",
      status: "COMPLETED",
      safetyConfirmed: true,
      notifiedRecipientCount: 2,
      escalationLevel: 1,
      currentRadiusKm: 2.5,
    });
  }
  const campusLunch = daysAgo(2, 13);
  historical.push({
    donorId: donor._id,
    foodName: "Campus lunch surplus",
    description: "Demo Data: recent campus leftover used for collector heatmap.",
    category: "Vegetarian",
    quantity: 48,
    availableQuantity: 0,
    preparedAt: campusLunch,
    createdAt: campusLunch,
    expiresAt: new Date(campusLunch.getTime() + 60 * 60 * 1000),
    location: point(ORIGIN.lng, ORIGIN.lat),
    address: "Polaris Campus",
    status: "COMPLETED",
    safetyConfirmed: true,
    notifiedRecipientCount: 3,
    escalationLevel: 1,
    currentRadiusKm: 2.5,
  });
  const areaQty: Record<string, { meals: number; days: number }> = {
    Koramangala: { meals: 20, days: 3 },
    HSR: { meals: 12, days: 4 },
    Indiranagar: { meals: 6, days: 5 },
  };
  for (const area of SURPLUS_AREAS) {
    const spec = areaQty[area.name];
    if (!spec) continue;
    const createdAt = daysAgo(spec.days, 13);
    historical.push({
      donorId: donor._id,
      foodName: `${area.name} surplus`,
      description: `Demo Data: recorded surplus near ${area.name}.`,
      category: "Vegetarian",
      quantity: spec.meals,
      availableQuantity: 0,
      preparedAt: createdAt,
      createdAt,
      expiresAt: new Date(createdAt.getTime() + 60 * 60 * 1000),
      location: point(area.lng, area.lat),
      address: area.name,
      status: "COMPLETED",
      safetyConfirmed: true,
      notifiedRecipientCount: 1,
      escalationLevel: 1,
      currentRadiusKm: 2.5,
    });
  }
  const docs = await Donation.insertMany(historical);
  const usedCodes = new Set<string>();
  const uniqueCode = () => {
    let code = generatePickupCode();
    while (usedCodes.has(code)) code = generatePickupCode();
    usedCodes.add(code);
    return code;
  };
  const claims = [];
  for (const d of docs.filter((x) => x.foodName === "Friday rice surplus")) {
    const claimedAt = new Date(d.createdAt.getTime() + 8 * 60 * 1000);
    const pickedUpAt = new Date(claimedAt.getTime() + 18 * 60 * 1000);
    claims.push({
      donationId: d._id,
      recipientId: helpingHands._id,
      quantity: 20,
      status: "PICKED_UP",
      claimCode: uniqueCode(),
      claimedAt,
      pickupDeadline: d.expiresAt,
      completedAt: pickedUpAt,
      pickedUpAt,
      pickupDurationMinutes: 18,
    });
    claims.push({
      donationId: d._id,
      recipientId: foodForAll._id,
      quantity: 14,
      status: "PICKED_UP",
      claimCode: uniqueCode(),
      claimedAt: new Date(claimedAt.getTime() + 60000),
      pickupDeadline: d.expiresAt,
      completedAt: pickedUpAt,
      pickedUpAt,
      pickupDurationMinutes: 17,
    });
  }
  const tueDocs = docs.filter((x) => x.foodName === "Midweek leftover");
  if (tueDocs[0]) {
    claims.push({
      donationId: tueDocs[0]._id,
      recipientId: communityCare._id,
      quantity: 5,
      status: "CANCELLED",
      claimCode: uniqueCode(),
      claimedAt: new Date(tueDocs[0].createdAt.getTime() + 5 * 60 * 1000),
      pickupDeadline: tueDocs[0].expiresAt,
    });
  }
  if (tueDocs[1]) {
    claims.push({
      donationId: tueDocs[1]._id,
      recipientId: distantAid._id,
      quantity: 4,
      status: "NO_SHOW",
      claimCode: uniqueCode(),
      claimedAt: new Date(tueDocs[1].createdAt.getTime() + 5 * 60 * 1000),
      pickupDeadline: tueDocs[1].expiresAt,
    });
  }
  if (tueDocs[2]) {
    const claimedAt = new Date(tueDocs[2].createdAt.getTime() + 6 * 60 * 1000);
    const pickedUpAt = new Date(claimedAt.getTime() + 12 * 60 * 1000);
    claims.push({
      donationId: tueDocs[2]._id,
      recipientId: communityCare._id,
      quantity: 12,
      status: "PICKED_UP",
      claimCode: uniqueCode(),
      claimedAt,
      pickupDeadline: tueDocs[2].expiresAt,
      completedAt: pickedUpAt,
      pickedUpAt,
      pickupDurationMinutes: 12,
    });
  }
  if (tueDocs[3]) {
    const claimedAt = new Date(tueDocs[3].createdAt.getTime() + 6 * 60 * 1000);
    const pickedUpAt = new Date(claimedAt.getTime() + 10 * 60 * 1000);
    claims.push({
      donationId: tueDocs[3]._id,
      recipientId: helpingHands._id,
      quantity: 12,
      status: "PICKED_UP",
      claimCode: uniqueCode(),
      claimedAt,
      pickupDeadline: tueDocs[3].expiresAt,
      completedAt: pickedUpAt,
      pickedUpAt,
      pickupDurationMinutes: 10,
    });
  }
  if (claims.length) await Claim.insertMany(claims as never);
}
