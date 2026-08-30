import mongoose from "mongoose";
import { config } from "./config.js";

export async function connectDatabase(): Promise<void> {
  try {
    mongoose.set("strictQuery", true);

    console.log("Connecting to MongoDB...");

    await mongoose.connect(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });

    console.log(
      `MongoDB connected successfully: ${mongoose.connection.name}`
    );
  } catch (error) {
    console.error("MongoDB connection failed.");

    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }

    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log("MongoDB disconnected.");
    }
  } catch (error) {
    console.error("MongoDB disconnect error:", error);
    throw error;
  }
}