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
    await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "tts_started", message: "TTS synthesis started (full)" } });
    const voiceA = (Array.isArray(ep.voicesJson) && (ep.voicesJson as any[])[0]) ? (ep.voicesJson as any[])[0] : ep.voice;
    const voiceB = (Array.isArray(ep.voicesJson) && (ep.voicesJson as any[])[1]) ? (ep.voicesJson as any[])[1] : undefined;
    const useTwoVoices = (ep.speakers || 1) > 1 && voiceA && voiceB;
    // Use full script for audio generation - let ElevenLabs handle duration naturally
    const limitedSsml = script.ssml || "";
    let limitedTurns: { speaker: "A" | "B"; text: string }[] | undefined = undefined;
    if (useTwoVoices) {
      limitedTurns = (script as any)?.turns;
    }
    await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "tts_full", message: `Using full script for audio generation` } });

    const ttsBuffer = useTwoVoices
      ? await synthesizeDialogueAb(
          limitedSsml,
          voiceA as string,
          voiceB as string,
          names || (script as any).speaker_names,
          limitedTurns || (script as any).turns
        )
      : await synthesizeSsml(limitedSsml, voiceA as string);
    await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "tts_done", message: `TTS synthesis done (${ttsBuffer.length} bytes)` } });

    // Extract first phrase (~10–15s) for a short preview video
    const firstPhrase: string | null = (() => {
      const p = (script as any)?.parts20s || null;
      if (!p || typeof p !== "object") return null;
      const keys = Object.keys(p).sort((a,b) => Number(a) - Number(b));
      if (keys.length === 0) return null;
      const v = String(p[keys[0]] || "").trim();
      return v || null;
    })();

    const base = env.APP_URL || "http://localhost:3000";
    const episodePrefix = `episodes/${episodeId}`;

    const extendTextToMinSeconds = (input: string, estimatedWpm: number, minSeconds: number): string => {
      const words = (input || "").trim().split(/\s+/).filter(Boolean);
      const wordsPerSec = Math.max(1, Math.round(estimatedWpm / 60));
      const minWords = Math.max(10, Math.ceil(wordsPerSec * minSeconds));
      let out = input.trim();
      while (out.split(/\s+/).filter(Boolean).length < minWords) {
        out = `${out} ${input.trim()}`.trim();
        if (out.length > 8000) break;
      }
      return out;
    };

    // Note: Defer Wavespeed call until after audio upload below

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

    // Kick off one Wavespeed lipsync generation now that audio is uploaded
    if (env.WAVESPEED_KEY && (ep.coverUrl || ep?.coverUrl)) {
      try {
        const base = env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
        const audioUrl = uploaded.url.startsWith("http") ? uploaded.url : `${base}${uploaded.url}`;
        let imageUrl = ep.coverUrl || "";
        if (imageUrl && !imageUrl.startsWith("http")) imageUrl = `${base}${imageUrl}`;
        await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "wavespeed_start", message: "Wavespeed lipsync submit" } });
        const wsSubmit = await fetch("https://api.wavespeed.ai/api/v3/wavespeed-ai/multitalk", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.WAVESPEED_KEY}` },
          body: JSON.stringify({ audio: audioUrl, image: imageUrl, prompt: "a person talking in a podcast", seed: -1 }),
        });
        const wsText = await wsSubmit.text();
        let wsData: any = null;
        try {
          wsData = JSON.parse(wsText);
        } catch {}
        await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "wavespeed_submit_http", message: `HTTP ${wsSubmit.status}` } });
        await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "wavespeed_response", message: wsText?.slice(0, 2000) || "<empty>" } });
        const wsId = (wsData?.data?.id || wsData?.id || wsData?.requestId || wsData?.request_id) as string | undefined;
        if (wsId) {
          await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "wavespeed_polling", message: `Starting Wavespeed polling for ${wsId}` } });
          for (let i = 0; i < 90; i++) { // ~15 minutes @ 10s
            await new Promise((r) => setTimeout(r, 10_000));
            const wsRes = await fetch(`https://api.wavespeed.ai/api/v3/predictions/${encodeURIComponent(wsId)}/result`, {
              headers: { Authorization: `Bearer ${env.WAVESPEED_KEY}` },
            });
            const wsResult = await wsRes.json();
            const status = wsResult?.data?.status || wsResult?.status;
            const error = wsResult?.data?.error || wsResult?.error;
            await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "wavespeed_poll", message: `Poll ${i+1}/90: status=${status}, error=${error || 'none'}` } });
            if (status === "failed" || error) {
              await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "wavespeed_failed", message: error || "Wavespeed failed" } });
              await prisma.episode.update({ where: { id: episodeId }, data: { errorMessage: "VIDEO_GENERATION_FAILED" } });
              break;
            }
            const outputs = wsResult?.data?.outputs || wsResult?.outputs;
            const videoUrlExternal = (Array.isArray(outputs) && outputs[0])
              ? outputs[0]
              : (wsResult?.data?.output?.video || wsResult?.output?.video || wsResult?.video || wsResult?.download_url || null);
            if (videoUrlExternal) {
              await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "wavespeed_success", message: `Video found: ${videoUrlExternal}` } });
              // Immediately set external URL so UI can display, then try to mirror to our storage
              await prisma.episode.update({ where: { id: episodeId }, data: { videoUrl: videoUrlExternal } });
              await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "wavespeed_ready", message: `Wavespeed video (external) -> ${videoUrlExternal}` } });
              try {
                const r = await fetch(videoUrlExternal);
                if (r.ok) {
                  const buf = Buffer.from(await r.arrayBuffer());
                  const upV = await uploadBuffer({ buffer: buf, contentType: "video/mp4", ext: ".mp4", prefix: "videos" });
                  await prisma.episode.update({ where: { id: episodeId }, data: { videoUrl: upV.url } });
                  await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "wavespeed_mirrored", message: `Mirrored video -> ${upV.url}` } });
                }
              } catch {}
              break;
            }
          }
        } else {
          const detail = wsText?.slice(0, 500) || "<no body>";
          await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "wavespeed_error", message: `No request id from Wavespeed (status=${wsSubmit.status}) body=${detail}` } });
          await prisma.episode.update({ where: { id: episodeId }, data: { errorMessage: "VIDEO_GENERATION_FAILED" } });
        }
      } catch (e: any) {
        await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "wavespeed_error", message: e?.message || "Wavespeed submit failed" } });
        await prisma.episode.update({ where: { id: episodeId }, data: { errorMessage: "VIDEO_GENERATION_FAILED" } });
      }
    }

    // No multi-part merging. Preview video (first sentence) + full-length audio only.

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


