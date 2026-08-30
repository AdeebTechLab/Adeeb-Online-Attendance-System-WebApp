import mongoose from "mongoose";
import { config } from "./config.js";

export async function connectDatabase(uri = config.MONGODB_URI) {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
