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
    const session = await getServerSession(authOptions as any);
    const userId = (session as any)?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const episodeId = params.id;
    const episode = await prisma.episode.findUnique({
      where: { id: episodeId },
      include: { eventLogs: { orderBy: { createdAt: 'desc' } } }
    });

    if (!episode) {
      return NextResponse.json({ error: "Episode not found" }, { status: 404 });
    }

    if (episode.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (episode.videoUrl) {
      return NextResponse.json({ error: "Episode already has a video" }, { status: 400 });
    }

    if (!episode.audioUrl) {
      return NextResponse.json({ error: "Episode has no audio" }, { status: 400 });
    }

    if (!env.WAVESPEED_KEY) {
      return NextResponse.json({ error: "WAVESPEED_KEY not configured" }, { status: 500 });
    }

    // Look for Wavespeed request ID in event logs
    let wavespeedId: string | null = null;
    for (const log of episode.eventLogs) {
      if (log.type === "wavespeed_start" || log.type === "wavespeed_polling") {
        // Try to extract request ID from message
        const match = log.message.match(/Starting Wavespeed polling for ([a-f0-9-]+)/);
        if (match) {
          wavespeedId = match[1];
          break;
        }
      }
    }

    if (!wavespeedId) {
      return NextResponse.json({ error: "No Wavespeed request ID found in logs" }, { status: 404 });
    }

    // Poll Wavespeed for the result
    await prisma.eventLog.create({ 
      data: { 
        episodeId, 
        userId: episode.userId, 
        type: "debug_retrieve_start", 
        message: `Debug: Starting video retrieval for ${wavespeedId}` 
      } 
    });

    for (let i = 0; i < 30; i++) { // Try for 5 minutes
      await new Promise((r) => setTimeout(r, 10_000));
      
      const wsRes = await fetch(`https://api.wavespeed.ai/api/v3/predictions/${encodeURIComponent(wavespeedId)}/result`, {
        headers: { Authorization: `Bearer ${env.WAVESPEED_KEY}` },
      });
      
      const wsResult = await wsRes.json();
      
      await prisma.eventLog.create({ 
        data: { 
          episodeId, 
          userId: episode.userId, 
          type: "debug_retrieve_poll", 
          message: `Debug: Poll ${i+1}/30: status=${wsResult?.status}, error=${wsResult?.error || 'none'}` 
        } 
      });

      if (wsResult?.status === "failed" || wsResult?.error) {
        await prisma.eventLog.create({ 
          data: { 
            episodeId, 
            userId: episode.userId, 
            type: "debug_retrieve_failed", 
            message: `Debug: Wavespeed failed - ${wsResult?.error || "Unknown error"}` 
          } 
        });
        return NextResponse.json({ 
          success: false, 
          error: `Wavespeed generation failed: ${wsResult?.error || "Unknown error"}` 
        });
      }

      const videoUrlExternal = (Array.isArray(wsResult?.outputs) && wsResult.outputs[0])
        ? wsResult.outputs[0]
        : (wsResult?.output?.video || wsResult?.video || wsResult?.download_url || null);

      if (videoUrlExternal) {
        await prisma.eventLog.create({ 
          data: { 
            episodeId, 
            userId: episode.userId, 
            type: "debug_retrieve_success", 
            message: `Debug: Video found - ${videoUrlExternal}` 
          } 
        });

        // Immediately set external URL so UI can display
        await prisma.episode.update({ 
          where: { id: episodeId }, 
          data: { videoUrl: videoUrlExternal } 
        });

        // Try to mirror to our storage
        try {
          const r = await fetch(videoUrlExternal);
          if (r.ok) {
            const buf = Buffer.from(await r.arrayBuffer());
            const upV = await uploadBuffer({ 
              buffer: buf, 
              contentType: "video/mp4", 
              ext: ".mp4", 
              prefix: "videos" 
            });
            await prisma.episode.update({ 
              where: { id: episodeId }, 
              data: { videoUrl: upV.url } 
            });
            await prisma.eventLog.create({ 
              data: { 
                episodeId, 
                userId: episode.userId, 
                type: "debug_retrieve_mirrored", 
                message: `Debug: Video mirrored to ${upV.url}` 
              } 
            });
          }
        } catch (mirrorError) {
          await prisma.eventLog.create({ 
            data: { 
              episodeId, 
              userId: episode.userId, 
              type: "debug_retrieve_mirror_failed", 
              message: `Debug: Failed to mirror video: ${mirrorError}` 
            } 
          });
          // Continue with external URL
        }

        return NextResponse.json({ 
          success: true, 
          message: "Video retrieved successfully",
          videoUrl: videoUrlExternal
        });
      }
    }

    await prisma.eventLog.create({ 
      data: { 
        episodeId, 
        userId: episode.userId, 
        type: "debug_retrieve_timeout", 
        message: "Debug: Video retrieval timed out after 5 minutes" 
      } 
    });

    return NextResponse.json({ 
      success: false, 
      error: "Video retrieval timed out after 5 minutes" 
    });

  } catch (error: any) {
    console.error("Error retrieving video:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || "Unknown error occurred" 
    }, { status: 500 });
  }
}
