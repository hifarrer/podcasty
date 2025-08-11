import { Queue, QueueEvents, Worker, JobsOptions } from "bullmq";
import { getRedis } from "@/lib/redis";

export type EpisodeJobData = {
  episodeId: string;
};

export const EPISODE_QUEUE = "episode-queue";

export function getEpisodeQueue(): Queue<EpisodeJobData> | null {
  const connection = getRedis() as any;
  if (!connection) return null;
  return new Queue<EpisodeJobData>(EPISODE_QUEUE, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      removeOnComplete: 1000,
      removeOnFail: 1000,
      backoff: { type: "exponential", delay: 5000 },
    } as JobsOptions,
  });
}

export function getEpisodeQueueEvents(): QueueEvents | null {
  const connection = getRedis() as any;
  if (!connection) return null;
  return new QueueEvents(EPISODE_QUEUE, { connection });
}

export function createWorker(processor: (data: EpisodeJobData) => Promise<void>) {
  const connection = getRedis() as any;
  if (!connection) throw new Error("Redis connection not configured");
  const worker = new Worker<EpisodeJobData>(
    EPISODE_QUEUE,
    async (job) => {
      await processor(job.data);
    },
    { connection }
  );
  return worker;
}


