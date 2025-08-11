import "dotenv/config";
import { createWorker } from "@/lib/queue";
import { processEpisode } from "./processEpisode";

createWorker(async (data) => processEpisode(data.episodeId));


