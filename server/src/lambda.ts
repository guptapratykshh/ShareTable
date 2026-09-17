import serverless from "serverless-http";
import { createApp } from "./app.js";
import { connectDb } from "./db.js";
import { User } from "./models/User.js";
import { Donation } from "./models/Donation.js";

const app = createApp();
let ready: Promise<void> | null = null;

async function init() {
  await connectDb();
  await Promise.all([User.createIndexes(), Donation.createIndexes()]);
}

export const handler = async (event: unknown, context: unknown) => {
  if (!ready) ready = init();
  await ready;
  return serverless(app)(event as never, context as never);
};
