import "dotenv/config";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { ingestFromUrl, ingestFromYouTube } from "@/services/ingest";
import { generateScript } from "@/services/llm";
import { synthesizeDialogueAb, synthesizeSsml } from "@/services/tts";
import { wavToMp3Loudnorm } from "@/services/audio";
import { uploadBuffer } from "@/lib/storage";
import { parseBuffer } from "music-metadata";

export async function processEpisode(episodeId: string): Promise<void> {
  const ep = await prisma.episode.findUnique({ where: { id: episodeId } });
  if (!ep) return;

  try {
    // eslint-disable-next-line no-console
    console.log(`[worker:fallback] Start episode ${episodeId}`);
    await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "episode_started", message: "Episode processing started" } });
    await prisma.episode.update({ where: { id: episodeId }, data: { status: "INGESTING" as any } });
    await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "ingest_started", message: "Ingestion started" } });

    // Ingestion / Input preparation
    let raw = "";
    if (ep.sourceType === "YOUTUBE" && ep.sourceUrl) {
      // eslint-disable-next-line no-console
      console.log(`[worker:fallback] Ingest YouTube ${ep.sourceUrl}`);
      raw = await ingestFromYouTube(ep.sourceUrl);
    } else if (ep.sourceType === "WEB" && ep.sourceUrl) {
      // eslint-disable-next-line no-console
      console.log(`[worker:fallback] Ingest Web ${ep.sourceUrl}`);
      raw = await ingestFromUrl(ep.sourceUrl);
    } else if (ep.sourceType === "PROMPT" && ep.promptText) {
      // eslint-disable-next-line no-console
      console.log(`[worker:fallback] Using prompt text (${ep.promptText.length} chars)`);
      raw = ep.promptText;
    } else if (ep.sourceType === "TXT" && ep.uploadKey) {
      const key = ep.uploadKey;
      const base = env.APP_URL || "http://localhost:3000";
      const url = `${base}/api/proxy/${encodeURIComponent(key)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch uploaded TXT: ${res.status}`);
      const text = await res.text();
      raw = text;
    } else {
      raw = "";
    }
    await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "ingest_done", message: `Input prepared, ${raw.length} chars` } });
    if (ep.sourceType !== "PROMPT") {
      if (!raw || raw.length < 20) {
        throw new Error("Ingestion returned insufficient content");
      }
    } else {
      if (!raw || raw.trim().length === 0) {
        throw new Error("Prompt text is empty");
      }
    }

    // Script
    await prisma.episode.update({ where: { id: episodeId }, data: { status: "SCRIPTING" as any } });
    // eslint-disable-next-line no-console
    console.log(`[worker:fallback] Generate script`);
    await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "script_started", message: "Script generation started" } });
    const names = (ep as any).speakerNamesJson as any || null;
    const script = await generateScript(raw, {
      mode: ep.mode as any,
      targetMinutes: ep.targetMinutes || undefined,
      language: ep.language,
      style: ep.style,
      twoSpeakers: (ep.speakers || 1) > 1,
      speakerNameA: names?.A,
      speakerNameB: names?.B,
    });
    await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "script_done", message: `Script generated with ${script.chapters?.length ?? 0} chapters` } });

    // TTS (single or dialogue)
    await prisma.episode.update({ where: { id: episodeId }, data: { status: "SYNTHESIZING" as any } });
    // eslint-disable-next-line no-console
    console.log(`[worker:fallback] Synthesize TTS`);
    await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "tts_started", message: "TTS synthesis started" } });
    const voiceA = (Array.isArray(ep.voicesJson) && (ep.voicesJson as any[])[0]) ? (ep.voicesJson as any[])[0] : ep.voice;
    const voiceB = (Array.isArray(ep.voicesJson) && (ep.voicesJson as any[])[1]) ? (ep.voicesJson as any[])[1] : undefined;
    const useTwoVoices = (ep.speakers || 1) > 1 && voiceA && voiceB;
    const ttsBuffer = useTwoVoices
      ? await synthesizeDialogueAb(
          script.ssml,
          voiceA as string,
          voiceB as string,
          names || (script as any).speaker_names,
          (script as any).turns
        )
      : await synthesizeSsml(script.ssml, voiceA as string);
    await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "tts_done", message: `TTS synthesis done (${ttsBuffer.length} bytes)` } });

    // New: Split into ~20-second parts using LLM output if available
    const parts20s: string[] = (() => {
      const p = (script as any)?.parts20s || null;
      if (!p || typeof p !== "object") return [];
      const keys = Object.keys(p).sort((a,b) => Number(a) - Number(b));
      return keys.map((k) => String(p[k] || "").trim()).filter(Boolean);
    })();

    const base = env.APP_URL || "http://localhost:3000";
    const episodePrefix = `episodes/${episodeId}`;
    const partAudioUrls: string[] = [];
    const partVideoUrls: string[] = [];

    if (parts20s.length > 0) {
      await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "split_info", message: `Generating ${parts20s.length} parts (@~20s)` } });
      for (let i = 0; i < parts20s.length; i++) {
        const idx = i + 1;
        const fname = `ep_${episodeId}_part${idx}`;
        const text = parts20s[i];
        await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "tts_part_start", message: `Synth part ${idx}` } });
        // Synthesize each part as single-voice using voiceA
        const partBuf = await synthesizeSsml(text, (Array.isArray(ep.voicesJson) && (ep.voicesJson as any[])[0]) ? (ep.voicesJson as any[])[0] : ep.voice);
        const partMp3 = await wavToMp3Loudnorm(partBuf, "mp3");
        const upA = await uploadBuffer({ buffer: partMp3, contentType: "audio/mpeg", ext: ".mp3", prefix: episodePrefix });
        partAudioUrls.push(upA.url.startsWith("http") ? upA.url : `${base}${upA.url}`);
        await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "tts_part_done", message: `Part ${idx} audio ${upA.url}` } });

        // Lipsync per-part if cover image available
        if (env.FAL_KEY && (ep.coverUrl || ep?.coverUrl)) {
          await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "video_part_start", message: `Lipsync part ${idx}` } });
          let imageUrl = ep.coverUrl || "";
          if (imageUrl && !imageUrl.startsWith("http")) imageUrl = `${base}${imageUrl}`;
          const submit = await fetch("https://queue.fal.run/fal-ai/infinitalk", {
            method: "POST",
            headers: { "Authorization": `Key ${env.FAL_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ image_url: imageUrl, audio_url: partAudioUrls[partAudioUrls.length - 1], prompt: "A realistic podcast" }),
          });
          const submitData = await submit.json();
          const requestId = submitData?.request_id;
          if (requestId) {
            for (let tries = 0; tries < 120; tries++) {
              await new Promise((r) => setTimeout(r, 2000));
              const status = await fetch(`https://queue.fal.run/fal-ai/infinitalk/requests/${encodeURIComponent(requestId)}/status`, {
                headers: { "Authorization": `Key ${env.FAL_KEY}` },
              });
              const s = await status.json();
              if (s?.status === "COMPLETED" || s?.status === "completed" || s?.success) {
                const resultRes = await fetch(`https://queue.fal.run/fal-ai/infinitalk/requests/${encodeURIComponent(requestId)}`, {
                  headers: { "Authorization": `Key ${env.FAL_KEY}` },
                });
                const result = await resultRes.json();
                const url = (result?.video?.url) || result?.video_url || result?.output?.[0]?.url || null;
                if (url) {
                  const r = await fetch(url);
                  if (r.ok) {
                    const contentType = r.headers.get("content-type") || "video/mp4";
                    const buf = Buffer.from(await r.arrayBuffer());
                    const ext = contentType.includes("webm") ? ".webm" : ".mp4";
                    const upV = await uploadBuffer({ buffer: buf, contentType, ext, prefix: episodePrefix });
                    partVideoUrls.push(upV.url.startsWith("http") ? upV.url : `${base}${upV.url}`);
                    await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "video_part_done", message: `Part ${idx} video ${upV.url}` } });
                  }
                }
                break;
              }
              if (s?.status === "FAILED" || s?.status === "failed") break;
            }
          }
        }
      }
    }

    // Post-processing
    await prisma.episode.update({ where: { id: episodeId }, data: { status: "AUDIO_POST" as any } });
    // eslint-disable-next-line no-console
    console.log(`[worker:fallback] Post-process audio`);
    await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "audio_post_started", message: "Audio post-processing started" } });
    let mp3 = await wavToMp3Loudnorm(ttsBuffer, "mp3");
    if (!mp3 || mp3.length < 1024) {
      const retryMp3Input = await synthesizeSsml(script.ssml + " " + script.ssml, ep.voice);
      const retryMp3 = await wavToMp3Loudnorm(retryMp3Input, "mp3");
      if (!retryMp3 || retryMp3.length < 1024) {
        throw new Error("Generated MP3 is too small");
      }
      mp3 = retryMp3;
    }
    let durationSec = 0;
    try {
      const meta = await parseBuffer(mp3, "audio/mpeg");
      if (meta.format.duration) {
        durationSec = Math.max(1, Math.round(meta.format.duration));
      }
    } catch {}
    if (!durationSec) {
      durationSec = Math.max(1, Math.round((mp3.length * 8) / 160_000));
    }
    const uploaded = await uploadBuffer({ buffer: mp3, contentType: "audio/mpeg", ext: ".mp3", prefix: "episodes" });
    await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "audio_post_done", message: `Audio uploaded to ${uploaded.url}` } });

    // Optional video render if we have a cover image and FAL_KEY
    if (env.FAL_KEY && (ep.coverUrl || ep?.coverUrl)) {
      await prisma.episode.update({ where: { id: episodeId }, data: { status: "VIDEO_RENDER" as any } });
      await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "video_render_start", message: "Starting video render via FAL" } });
      try {
        const base = env.APP_URL || "http://localhost:3000";
        const audioUrl = uploaded.url.startsWith("http") ? uploaded.url : `${base}${uploaded.url}`;
        // If image is stored via our proxy, construct the absolute proxy URL to ensure it resolves publicly
        let imageUrl = ep.coverUrl || "";
        if (imageUrl && !imageUrl.startsWith("http")) {
          imageUrl = `${base}${imageUrl}`;
        }
        // Additionally, if this is a stored S3 key style like "media/..." normalize to our proxy endpoint
        if (imageUrl && imageUrl.includes("/api/proxy/") === false && (imageUrl.includes("media%2F") || imageUrl.includes("/media/") || imageUrl.includes("episodes%2F") || imageUrl.includes("/uploads/"))) {
          const keyPart = imageUrl.split("/api/proxy/")[1] || imageUrl.split(base)[1] || imageUrl;
          const encodedKey = encodeURIComponent(keyPart.replace(/^\//, ""));
          imageUrl = `${base}/api/proxy/${encodedKey}`;
        }
        const submit = await fetch("https://queue.fal.run/fal-ai/infinitalk", {
          method: "POST",
          headers: { "Authorization": `Key ${env.FAL_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ image_url: imageUrl, audio_url: audioUrl, prompt: "A realistic podcast" }),
        });
        const submitData = await submit.json();
        const requestId = submitData?.request_id;
        if (!requestId) throw new Error("FAL request_id missing");
        // Poll until completed
        let videoUrl: string | null = null;
        for (let i = 0; i < 120; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          const status = await fetch(`https://queue.fal.run/fal-ai/infinitalk/requests/${encodeURIComponent(requestId)}/status`, {
            headers: { "Authorization": `Key ${env.FAL_KEY}` },
          });
          const s = await status.json();
          if (s?.status === "COMPLETED" || s?.status === "completed" || s?.success) {
            const resultRes = await fetch(`https://queue.fal.run/fal-ai/infinitalk/requests/${encodeURIComponent(requestId)}`, {
              headers: { "Authorization": `Key ${env.FAL_KEY}` },
            });
            const result = await resultRes.json();
            const url = (result?.video?.url) || result?.video_url || result?.output?.[0]?.url || null;
            if (url) {
              const r = await fetch(url);
              if (!r.ok) throw new Error(`Video fetch failed: ${r.status}`);
              const contentType = r.headers.get("content-type") || "video/mp4";
              const buf = Buffer.from(await r.arrayBuffer());
              const ext = contentType.includes("webm") ? ".webm" : ".mp4";
              const up = await uploadBuffer({ buffer: buf, contentType, ext, prefix: "videos" });
              videoUrl = up.url;
            }
            break;
          }
          if (s?.status === "FAILED" || s?.status === "failed") break;
        }
        if (videoUrl) {
          await prisma.episode.update({ where: { id: episodeId }, data: { videoUrl } });
          await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "video_render_done", message: `Video uploaded to ${videoUrl}` } });
        } else {
          await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "video_render_skip", message: "Video not available" } });
        }
      } catch (ve: any) {
        await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "video_render_error", message: ve?.message || "Video render failed" } });
      }
    }

    // If parts were generated and at least one video exists, attempt external merge
    if (partVideoUrls.length > 0 && env.FFMPEG_API_KEY) {
      try {
        await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "merge_start", message: `Merging ${partVideoUrls.length} videos` } });
        const mergeRes = await fetch("https://ffmpegapi.net/api/merge_videos", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-Key": env.FFMPEG_API_KEY },
          body: JSON.stringify({ video_urls: partVideoUrls, audio_url: (uploaded.url.startsWith("http") ? uploaded.url : `${base}${uploaded.url}`), async: false })
        });
        const mergeData = await mergeRes.json();
        if (mergeRes.ok && mergeData?.download_url) {
          // Download merged and upload to our storage
          const r = await fetch(mergeData.download_url);
          if (r.ok) {
            const buf = Buffer.from(await r.arrayBuffer());
            const upMerged = await uploadBuffer({ buffer: buf, contentType: "video/mp4", ext: ".mp4", prefix: "videos" });
            await prisma.episode.update({ where: { id: episodeId }, data: { videoUrl: upMerged.url } });
            await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "merge_done", message: `Merged video ${upMerged.url}` } });
          }
        } else {
          await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "merge_skip", message: `Merge failed or no URL` } });
        }
      } catch (e: any) {
        await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "merge_error", message: e?.message || "Merge error" } });
      }
    }

    await prisma.episode.update({
      where: { id: episodeId },
      data: {
        status: "PUBLISHED" as any,
        title: script.title,
        ssml: script.ssml,
        estimatedWpm: script.estimated_wpm,
        chaptersJson: script.chapters as any,
        showNotesMd: script.show_notes,
        audioUrl: uploaded.url,
        durationSec,
      },
    });
    await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "publish_done", message: `Published with url ${uploaded.url}` } });
    // eslint-disable-next-line no-console
    console.log(`[worker:fallback] Done episode ${episodeId}`);
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error(`[worker:fallback] Failed episode ${episodeId}`, e);
    await prisma.episode.update({ where: { id: episodeId }, data: { status: "FAILED" as any, errorMessage: e.message } });
    await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "error", message: e.message?.toString() || "Unknown error" } });
  }
}


