import mongoose from "mongoose";
import { config } from "../config/index.js";

export async function connectDb(): Promise<typeof mongoose> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(config.mongoUri);
  const topology = mongoose.connection.readyState;
  if (topology !== 1) {
    throw new Error("MongoDB connection failed");
  }
  return mongoose;
}
