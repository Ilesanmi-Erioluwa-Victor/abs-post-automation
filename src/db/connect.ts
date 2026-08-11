import mongoose from "mongoose";
import { env } from "../config/env";

let connectionPromise: Promise<typeof mongoose> | null = null;

mongoose.set("bufferTimeoutMS", 120_000);

export function connectDB(): Promise<typeof mongoose> {
  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(env.mongodbUri, {
        serverSelectionTimeoutMS: 15000,
        autoIndex: true,
      })
      .catch((error) => {
        connectionPromise = null;
        throw error;
      });
  }
  return connectionPromise;
}

export async function disconnectDB(): Promise<void> {
  if (connectionPromise) {
    await mongoose.disconnect();
    connectionPromise = null;
  }
}

export function getConnectionState(): string {
  return mongoose.connection.readyState === 1 ? "connected" : "disconnected";
}

export async function waitForDB(timeoutMs = 120_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (mongoose.connection.readyState !== 1) {
    if (Date.now() > deadline) {
      throw new Error("Timed out waiting for MongoDB connection");
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
