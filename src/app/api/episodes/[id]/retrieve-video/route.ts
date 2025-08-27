import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { uploadBuffer } from "@/lib/storage";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log("[DEBUG] Retrieve video request started for episode:", params.id);
    
    const session = await getServerSession(authOptions as any);
    const userId = (session as any)?.user?.id;
    if (!userId) {
      console.log("[DEBUG] Unauthorized - no user ID");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[DEBUG] User ID:", userId);

    const episodeId = params.id;
    const episode = await prisma.episode.findUnique({
      where: { id: episodeId },
      include: { eventLogs: { orderBy: { createdAt: 'desc' } } }
    });

    if (!episode) {
      console.log("[DEBUG] Episode not found");
      return NextResponse.json({ error: "Episode not found" }, { status: 404 });
    }

    console.log("[DEBUG] Episode found:", {
      id: episode.id,
      userId: episode.userId,
      hasVideo: !!episode.videoUrl,
      hasAudio: !!episode.audioUrl,
      eventLogsCount: episode.eventLogs.length
    });

    if (episode.userId !== userId) {
      console.log("[DEBUG] Unauthorized - episode belongs to different user");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (episode.videoUrl) {
      console.log("[DEBUG] Episode already has video:", episode.videoUrl);
      return NextResponse.json({ error: "Episode already has a video" }, { status: 400 });
    }

    if (!episode.audioUrl) {
      console.log("[DEBUG] Episode has no audio");
      return NextResponse.json({ error: "Episode has no audio" }, { status: 400 });
    }

    if (!env.WAVESPEED_KEY) {
      console.log("[DEBUG] WAVESPEED_KEY not configured");
      return NextResponse.json({ error: "WAVESPEED_KEY not configured" }, { status: 500 });
    }

    // Look for Wavespeed request ID in event logs
    console.log("[DEBUG] Searching for Wavespeed request ID in event logs...");
    console.log("[DEBUG] Event logs:", episode.eventLogs.map(log => ({ type: log.type, message: log.message })));
    
    let wavespeedId: string | null = null;
    
    // First, try to find any log that mentions wavespeed
    const wavespeedLogs = episode.eventLogs.filter(log => 
      log.type.includes('wavespeed') || 
      log.message.toLowerCase().includes('wavespeed')
    );
    
    console.log("[DEBUG] Found wavespeed-related logs:", wavespeedLogs);
    
    // Try multiple patterns to extract the request ID
    for (const log of episode.eventLogs) {
      // Pattern 1: "Starting Wavespeed polling for [id]" - this is the expected format
      let match = log.message.match(/Starting Wavespeed polling for ([a-f0-9]+)/);
      if (match) {
        wavespeedId = match[1];
        console.log("[DEBUG] Found Wavespeed ID (pattern 1):", { type: log.type, message: log.message, extractedId: wavespeedId });
        break;
      }
      
      // Pattern 2: Look for any 32-character alphanumeric string in wavespeed logs (Wavespeed IDs are 32 chars)
      if (log.type.includes('wavespeed') || log.message.toLowerCase().includes('wavespeed')) {
        match = log.message.match(/([a-f0-9]{32})/);
        if (match) {
          wavespeedId = match[1];
          console.log("[DEBUG] Found Wavespeed ID (pattern 2):", { type: log.type, message: log.message, extractedId: wavespeedId });
          break;
        }
      }
      
      // Pattern 3: Look for any UUID-like string in wavespeed logs
      if (log.type.includes('wavespeed') || log.message.toLowerCase().includes('wavespeed')) {
        match = log.message.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/);
        if (match) {
          wavespeedId = match[1];
          console.log("[DEBUG] Found Wavespeed ID (pattern 3):", { type: log.type, message: log.message, extractedId: wavespeedId });
          break;
        }
      }
      
      // Pattern 4: Look for any 32+ character alphanumeric string in wavespeed logs
      if (log.type.includes('wavespeed') || log.message.toLowerCase().includes('wavespeed')) {
        match = log.message.match(/([a-f0-9]{32,})/);
        if (match) {
          wavespeedId = match[1];
          console.log("[DEBUG] Found Wavespeed ID (pattern 4):", { type: log.type, message: log.message, extractedId: wavespeedId });
          break;
        }
      }
    }

    if (!wavespeedId) {
      console.log("[DEBUG] No Wavespeed request ID found in logs");
      console.log("[DEBUG] All event log types:", Array.from(new Set(episode.eventLogs.map(log => log.type))));
      console.log("[DEBUG] All event log messages:", episode.eventLogs.map(log => log.message));

      // As a recovery path for debug: submit a NEW Wavespeed job once, then poll it
      try {
        const reqOrigin = (request as any)?.nextUrl?.origin || "";
        const base = env.APP_URL || reqOrigin || "https://www.podcasty.site/";
        const audioUrl = episode.audioUrl!.startsWith("http") ? episode.audioUrl! : `${base}${episode.audioUrl}`;
        let imageUrl = episode.coverUrl || "";
        if (!imageUrl) {
          return NextResponse.json({ error: "No cover image on episode; cannot submit video job." }, { status: 400 });
        }
        if (!imageUrl.startsWith("http")) imageUrl = `${base}${imageUrl}`;

        await prisma.eventLog.create({ data: { episodeId, userId: episode.userId, type: "debug_retrieve_submit", message: `Debug: Submitting new Wavespeed job` } });
        const wsSubmit = await fetch("https://api.wavespeed.ai/api/v3/wavespeed-ai/multitalk", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.WAVESPEED_KEY}` },
          body: JSON.stringify({ audio: audioUrl, image: imageUrl, prompt: "a person talking in a podcast", seed: -1 }),
        });
        const wsText = await wsSubmit.text();
        let wsData: any = null;
        try { wsData = JSON.parse(wsText); } catch {}
        await prisma.eventLog.create({ data: { episodeId, userId: episode.userId, type: "debug_retrieve_submit_http", message: `HTTP ${wsSubmit.status}` } });
        await prisma.eventLog.create({ data: { episodeId, userId: episode.userId, type: "debug_retrieve_response", message: wsText?.slice(0, 2000) || "<empty>" } });
        const newId = (wsData?.data?.id || wsData?.id || wsData?.requestId || wsData?.request_id) as string | undefined;
        if (!newId) {
          return NextResponse.json({
            error: "Failed to submit new Wavespeed job",
            debug: {
              httpStatus: wsSubmit.status,
              body: wsText?.slice(0, 2000) || "<empty>",
              audioUrl,
              imageUrl,
            }
          }, { status: 502 });
        }
        wavespeedId = newId;
        await prisma.eventLog.create({ data: { episodeId, userId: episode.userId, type: "debug_retrieve_polling", message: `Debug: Polling new Wavespeed id ${wavespeedId}` } });
      } catch (submitErr: any) {
        await prisma.eventLog.create({ data: { episodeId, userId: episode.userId, type: "debug_retrieve_submit_error", message: submitErr?.message || "Unknown submit error" } });
        return NextResponse.json({ error: submitErr?.message || "Failed to submit Wavespeed job" }, { status: 500 });
      }
    }

    console.log("[DEBUG] Using Wavespeed request ID:", wavespeedId);

    // Single, short call to avoid serverless timeouts. Client can call repeatedly.
    try { await prisma.eventLog.create({ data: { episodeId, userId: episode.userId, type: "debug_retrieve_start", message: `Debug: Checking video for ${wavespeedId}` } }); } catch {}

    const apiUrl = `https://api.wavespeed.ai/api/v3/predictions/${encodeURIComponent(wavespeedId)}/result`;
    console.log(`[DEBUG] Single poll - Making API call to:`, apiUrl);
    const wsRes = await fetch(apiUrl, { headers: { Authorization: `Bearer ${env.WAVESPEED_KEY}` } });
    const wsResult = await wsRes.json();
    console.log(`[DEBUG] Single poll - Response status:`, wsRes.status, "body:", wsResult);
    try { await prisma.eventLog.create({ data: { episodeId, userId: episode.userId, type: "debug_retrieve_poll", message: `Debug: status=${wsResult?.status}, error=${wsResult?.error || 'none'}` } }); } catch {}

    const status = wsResult?.data?.status || wsResult?.status;
    const error = wsResult?.data?.error || wsResult?.error;
    
    if (status === "failed" || error) {
      try { await prisma.eventLog.create({ data: { episodeId, userId: episode.userId, type: "debug_retrieve_failed", message: `Debug: Wavespeed failed - ${error || 'Unknown'}` } }); } catch {}
      return NextResponse.json({ success: false, status: status || 'failed', error: error || 'Unknown error' }, { status: 200 });
    }

    const outputs = wsResult?.data?.outputs || wsResult?.outputs;
    const videoUrlExternal = (Array.isArray(outputs) && outputs[0])
      ? outputs[0]
      : (wsResult?.data?.output?.video || wsResult?.output?.video || wsResult?.video || wsResult?.download_url || null);

    if (videoUrlExternal) {
      try { await prisma.eventLog.create({ data: { episodeId, userId: episode.userId, type: "debug_retrieve_success", message: `Debug: Video found - ${videoUrlExternal}` } }); } catch {}
      await prisma.episode.update({ where: { id: episodeId }, data: { videoUrl: videoUrlExternal } });
      return NextResponse.json({ success: true, status: "completed", videoUrl: videoUrlExternal }, { status: 200 });
    }

    // Not ready yet
    return NextResponse.json({ success: false, status: status || 'processing' }, { status: 200 });

  } catch (error: any) {
    console.error("[DEBUG] Error retrieving video:", error);
    console.error("[DEBUG] Error stack:", error.stack);
    return NextResponse.json({ 
      success: false, 
      error: error.message || "Unknown error occurred" 
    }, { status: 500 });
  }
}
