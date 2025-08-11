import IORedis from "ioredis";
import { env } from "@/lib/env";

let client: IORedis | null = null;

export function getRedis(): IORedis | null {
  if (!client && env.REDIS_URL) {
    // BullMQ requires maxRetriesPerRequest to be null to work with blocking commands
    client = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      // keep other defaults; connect lazily is fine
      lazyConnect: true,
    });
  }
  return client;
}


