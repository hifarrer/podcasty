import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEpisodeQueue } from "@/lib/queue";
import { processEpisode } from "@/workers/processEpisode";
import { getCurrentUserId, getCurrentUserIdOrDemo } from "@/lib/server-auth";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CreateEpisodeSchema = z.object({
  sourceType: z.enum(["YOUTUBE", "WEB", "PDF", "TXT", "PROMPT"]),
  sourceUrl: z.string().url().optional(),
  uploadKey: z.string().optional(),
  mode: z.enum(["SUMMARY", "READTHROUGH", "DISCUSSION"]).default("SUMMARY"),
  language: z.string().default("en"),
  style: z.string().default("conversational"),
  voice: z.string().optional(),
  speakers: z.number().int().min(1).max(2).optional(),
  voices: z.array(z.string()).optional(),
  promptText: z.string().max(35000, "Prompt text exceeds 35,000 characters").optional(),
  targetMinutes: z.number().int().min(1).max(40, "Target minutes must be 40 or less").optional(),
  includeIntro: z.boolean().default(true),
  includeOutro: z.boolean().default(true),
  includeMusic: z.boolean().default(false),
  chaptersEnabled: z.boolean().default(true),
  speakerNames: z.object({ A: z.string().optional(), B: z.string().optional() }).optional(),
  isPublic: z.boolean().default(true),
  coverUrl: z.string().url().optional(),
  videoImageUrl: z.string().url().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateEpisodeSchema.parse(body);
    console.log("[api/episodes] create payload", parsed);

    const userId = await getCurrentUserIdOrDemo();

    // Enforce per-plan monthly limits for authenticated users only
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, plan: true } });
    if (user && user.email) {
      const limits: Record<string, number> = { FREE: 3, BASIC: 15, PREMIUM: 60 };
      const plan = user.plan as keyof typeof limits;
      const limit = limits[plan] ?? 3;
      const start = new Date(); start.setUTCDate(1); start.setUTCHours(0,0,0,0);
      const used = await prisma.episode.count({ where: { userId, createdAt: { gte: start } } });
      if (used >= limit) {
        return NextResponse.json({ error: `Monthly limit reached for ${plan} plan` }, { status: 403 });
      }
    }

    const episode = await prisma.episode.create({
      data: {
        userId,
        sourceType: parsed.sourceType as any,
        sourceUrl: parsed.sourceUrl,
        uploadKey: parsed.uploadKey,
        mode: parsed.mode as any,
        language: parsed.language,
        style: parsed.style,
        voice: (parsed.voices && parsed.voices[0]) || parsed.voice || undefined,
        speakers: parsed.speakers ?? (parsed.voices ? Math.min(parsed.voices.length, 2) : 1),
        voicesJson: parsed.voices ? (parsed.voices as any) : undefined,
        speakerNamesJson: parsed.speakerNames ? (parsed.speakerNames as any) : undefined,
        promptText: parsed.promptText,
        targetMinutes: parsed.targetMinutes,
        includeIntro: parsed.includeIntro,
        includeOutro: parsed.includeOutro,
        includeMusic: parsed.includeMusic,
        chaptersEnabled: parsed.chaptersEnabled,
        isPublic: parsed.isPublic,
        coverUrl: parsed.coverUrl,
      },
    });

    const q = getEpisodeQueue();
    if (!q) {
      // No Redis/worker: process inline as a fallback so UI progresses
      await prisma.eventLog.create({ data: { episodeId: episode.id, userId, type: "enqueue_bypass", message: "Queue not available, processing inline" } });
      // fire and forget to avoid blocking the response too long
      processEpisode(episode.id).catch(() => {});
    } else {
      await prisma.eventLog.create({ data: { episodeId: episode.id, userId, type: "enqueue_attempt", message: "Adding job to queue" } });
      try {
        const job = await q.add("generate", { episodeId: episode.id });
        await prisma.episode.update({ where: { id: episode.id }, data: { jobId: job.id } });
        await prisma.eventLog.create({ data: { episodeId: episode.id, userId, type: "enqueue_ok", message: `Job enqueued: ${job.id}` } });
      } catch (e: any) {
        await prisma.episode.update({ where: { id: episode.id }, data: { status: "FAILED" as any, errorMessage: e.message } });
        await prisma.eventLog.create({ data: { episodeId: episode.id, userId, type: "enqueue_error", message: e.message?.toString() || "enqueue failed" } });
        return NextResponse.json({ error: `Enqueue failed: ${e.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({ id: episode.id }, { status: 201 });
  } catch (err: any) {
    console.error("[api/episodes] create error", err);
    return NextResponse.json({ error: err.message || "Unknown error" }, { status: 400 });
  }
}

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const episodes = await prisma.episode.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ episodes });
  } catch (error) {
    console.error("[api/episodes] GET error", error);
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
}


