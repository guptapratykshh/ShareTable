import mongoose from "mongoose";
import { config } from "./config.js";

export async function connectDb(uri = config.databaseUrl): Promise<typeof mongoose> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 15000,
  });
  return mongoose;
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
