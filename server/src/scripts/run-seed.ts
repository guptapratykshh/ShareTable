import { connectDb, disconnectDb } from "../db.js";
import { seedDatabase } from "./seed.js";

await connectDb();
await seedDatabase();
console.log("Seeded ShareTable demo data.");
console.log("Donor     pratykshgupta9999@gmail.com / Demo@123");
console.log("Recipient helpinghands@foodrescue.demo / Demo@123");
console.log("Admin     admin.sharedtable@gmail.com / Demo@123");
await disconnectDb();
