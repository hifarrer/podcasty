import "dotenv/config";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { ingestFromUrl, ingestFromYouTube } from "@/services/ingest";
import { generateScript } from "@/services/llm";
import { synthesizeDialogueAb, synthesizeSsml } from "@/services/tts";
import { wavToMp3Loudnorm } from "@/services/audio";
import { uploadBuffer } from "@/lib/storage";
import { parseBuffer } from "music-metadata";

interface VideoPart {
  partNumber: number;
  audioUrl: string;
  videoUrl?: string;
  wavespeedId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

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

         // Extract 30-second parts from script
     const parts30s = (script as any)?.parts30s || null;
     if (!parts30s || typeof parts30s !== "object") {
       throw new Error("Script does not contain 30-second parts");
     }
     
     const partKeys = Object.keys(parts30s).sort((a, b) => Number(a) - Number(b));
     const expectedParts = Math.max(1, Math.floor((ep.targetMinutes || 1) * 2));
     const maxAllowedParts = expectedParts + 1; // Allow 1 extra part for tolerance
     
     console.log(`[worker:fallback] Found ${partKeys.length} parts, expected ${expectedParts} (max ${maxAllowedParts})`);
     await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "parts_found", message: `Found ${partKeys.length} parts, expected ${expectedParts} (max ${maxAllowedParts})` } });
     
     // Validate number of parts
     if (partKeys.length > maxAllowedParts) {
       throw new Error(`Script has too many parts: ${partKeys.length} (expected ${expectedParts}, max ${maxAllowedParts}). Target duration: ${ep.targetMinutes} minutes`);
     }
     
     if (partKeys.length < expectedParts) {
       console.log(`[worker:fallback] Warning: Script has fewer parts than expected: ${partKeys.length} (expected ${expectedParts})`);
       await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "parts_warning", message: `Script has fewer parts than expected: ${partKeys.length} (expected ${expectedParts})` } });
     }

     // Generate audio for each part
     await prisma.episode.update({ where: { id: episodeId }, data: { status: "AUDIO_POST" as any } });
     console.log(`[worker:fallback] Starting audio generation for ${partKeys.length} parts`);
     await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "audio_parts_started", message: `Starting audio generation for ${partKeys.length} parts` } });

     const videoParts: VideoPart[] = [];
     const base = env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

     // Generate audio for each part
     for (const partKey of partKeys) {
       const partNumber = parseInt(partKey);
       const partText = parts30s[partKey];
       
       console.log(`[worker:fallback] Generating audio for part ${partNumber}`);
       await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "audio_part_started", message: `Generating audio for part ${partNumber}` } });

       // Convert part text to SSML
       const partSsml = `<speak>${partText}</speak>`;
       
       // Generate TTS for this part
       const partTtsBuffer = useTwoVoices
         ? await synthesizeDialogueAb(partSsml, voiceA as string, voiceB as string, names || (script as any).speaker_names, [])
         : await synthesizeSsml(partSsml, voiceA as string);

               // Post-process audio
        const partMp3 = await wavToMp3Loudnorm(partTtsBuffer, "mp3");
       if (!partMp3 || partMp3.length < 1024) {
         throw new Error(`Generated MP3 for part ${partNumber} is too small`);
       }

               // Upload audio part
        const uploadedPart = await uploadBuffer({ 
          buffer: partMp3, 
          contentType: "audio/mpeg", 
          ext: ".mp3", 
          prefix: "episodes"
        });

       const audioUrl = uploadedPart.url.startsWith("http") ? uploadedPart.url : `${base}${uploadedPart.url}`;
       
       videoParts.push({
         partNumber,
         audioUrl,
         status: 'pending'
       });

       console.log(`[worker:fallback] Audio part ${partNumber} uploaded: ${audioUrl}`);
       await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "audio_part_done", message: `Part ${partNumber} audio uploaded: ${audioUrl}` } });
     }

     // Submit all video generation jobs to Wavespeed
     if (env.WAVESPEED_KEY && (ep.coverUrl || ep?.coverUrl)) {
       console.log(`[worker:fallback] Starting video generation for ${videoParts.length} parts`);
       await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "video_generation_started", message: `Starting video generation for ${videoParts.length} parts` } });

       let imageUrl = ep.coverUrl || "";
       if (imageUrl && !imageUrl.startsWith("http")) imageUrl = `${base}${imageUrl}`;

       // Submit all video jobs
       for (const part of videoParts) {
         try {
           console.log(`[worker:fallback] Submitting Wavespeed job for part ${part.partNumber}`);
           await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "wavespeed_submit_started", message: `Submitting Wavespeed job for part ${part.partNumber}` } });

           const wsSubmit = await fetch("https://api.wavespeed.ai/api/v3/wavespeed-ai/multitalk", {
             method: "POST",
             headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.WAVESPEED_KEY}` },
             body: JSON.stringify({ 
               audio: part.audioUrl, 
               image: imageUrl, 
               prompt: "a person talking in a podcast", 
               seed: -1 
             }),
           });

           const wsText = await wsSubmit.text();
           let wsData: any = null;
           try {
             wsData = JSON.parse(wsText);
           } catch {}

           await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "wavespeed_submit_response", message: `Part ${part.partNumber} - HTTP ${wsSubmit.status}` } });

           const wsId = (wsData?.data?.id || wsData?.id || wsData?.requestId || wsData?.request_id) as string | undefined;
           if (wsId) {
             part.wavespeedId = wsId;
             part.status = 'processing';
             console.log(`[worker:fallback] Part ${part.partNumber} submitted with ID: ${wsId}`);
             await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "wavespeed_submit_success", message: `Part ${part.partNumber} submitted with ID: ${wsId}` } });
           } else {
             part.status = 'failed';
             console.log(`[worker:fallback] Part ${part.partNumber} failed to get request ID`);
             await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "wavespeed_submit_failed", message: `Part ${part.partNumber} failed to get request ID` } });
           }
         } catch (e: any) {
           part.status = 'failed';
           console.log(`[worker:fallback] Part ${part.partNumber} submit error:`, e.message);
           await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "wavespeed_submit_error", message: `Part ${part.partNumber} error: ${e.message}` } });
         }
       }

       // Poll for all video results
       console.log(`[worker:fallback] Starting to poll for ${videoParts.filter(p => p.status === 'processing').length} video results`);
       await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "video_polling_started", message: `Starting to poll for video results` } });

       const maxPollAttempts = 90; // ~15 minutes @ 10s
       for (let pollAttempt = 0; pollAttempt < maxPollAttempts; pollAttempt++) {
         console.log(`[worker:fallback] Poll attempt ${pollAttempt + 1}/${maxPollAttempts}`);
         
         let allCompleted = true;
         let anyFailed = false;

         for (const part of videoParts) {
           if (part.status === 'completed' || part.status === 'failed') continue;
           
           if (!part.wavespeedId) {
             part.status = 'failed';
             anyFailed = true;
             continue;
           }

           try {
             const wsRes = await fetch(`https://api.wavespeed.ai/api/v3/predictions/${encodeURIComponent(part.wavespeedId)}/result`, {
               headers: { Authorization: `Bearer ${env.WAVESPEED_KEY}` },
             });

             const wsResult = await wsRes.json();
             const status = wsResult?.data?.status || wsResult?.status;
             const error = wsResult?.data?.error || wsResult?.error;

             console.log(`[worker:fallback] Part ${part.partNumber} status: ${status}, error: ${error || 'none'}`);
             await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "wavespeed_poll", message: `Part ${part.partNumber} - Poll ${pollAttempt + 1}: status=${status}, error=${error || 'none'}` } });

             if (status === "failed" || error) {
               part.status = 'failed';
               anyFailed = true;
               await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "wavespeed_failed", message: `Part ${part.partNumber} failed: ${error || 'Unknown error'}` } });
             } else if (status === "succeeded") {
               const outputs = wsResult?.data?.outputs || wsResult?.outputs;
               const videoUrlExternal = (Array.isArray(outputs) && outputs[0])
                 ? outputs[0]
                 : (wsResult?.data?.output?.video || wsResult?.output?.video || wsResult?.video || wsResult?.download_url || null);

               if (videoUrlExternal) {
                 // Download and upload video to our storage
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
                     
                     part.videoUrl = upV.url;
                     part.status = 'completed';
                     
                     console.log(`[worker:fallback] Part ${part.partNumber} video completed: ${upV.url}`);
                     await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "wavespeed_success", message: `Part ${part.partNumber} video completed: ${upV.url}` } });
                   }
                 } catch (downloadError: any) {
                   console.log(`[worker:fallback] Part ${part.partNumber} download error:`, downloadError.message);
                   await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "wavespeed_download_error", message: `Part ${part.partNumber} download error: ${downloadError.message}` } });
                 }
               }
             } else {
               allCompleted = false; // Still processing
             }
           } catch (pollError: any) {
             console.log(`[worker:fallback] Part ${part.partNumber} poll error:`, pollError.message);
             await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "wavespeed_poll_error", message: `Part ${part.partNumber} poll error: ${pollError.message}` } });
           }
         }

         if (allCompleted) {
           console.log(`[worker:fallback] All video parts completed`);
           await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "video_polling_completed", message: `All video parts completed` } });
           break;
         }

         if (anyFailed) {
           console.log(`[worker:fallback] Some video parts failed`);
           await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "video_polling_failed", message: `Some video parts failed` } });
           break;
         }

         // Wait 10 seconds before next poll
         await new Promise((r) => setTimeout(r, 10_000));
       }

       // Merge videos using FFMPEG API
       const completedVideos = videoParts.filter(p => p.status === 'completed' && p.videoUrl);
       if (completedVideos.length > 0) {
         console.log(`[worker:fallback] Merging ${completedVideos.length} videos using FFMPEG API`);
         await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "ffmpeg_merge_started", message: `Merging ${completedVideos.length} videos` } });

         try {
           const videoUrls = completedVideos.map(p => p.videoUrl!);
           const audioUrl = videoParts[0]?.audioUrl; // Use first part's audio as reference

           const ffmpegResponse = await fetch("https://ffmpegapi.net/api/merge_videos", {
             method: "POST",
             headers: {
               "X-API-Key": "ffmpeg_KfTAf98EY9OCuriwBtLT34ZtWZLJtnXX",
               "Content-Type": "application/json"
             },
             body: JSON.stringify({
               video_urls: videoUrls,
               audio_url: audioUrl,
               async: true
             })
           });

           const ffmpegResult = await ffmpegResponse.json();
           console.log(`[worker:fallback] FFMPEG merge response:`, ffmpegResult);

           if (ffmpegResult.success && ffmpegResult.download_url) {
             // Download the merged video
             const mergedVideoResponse = await fetch(ffmpegResult.download_url);
             if (mergedVideoResponse.ok) {
               const mergedVideoBuffer = Buffer.from(await mergedVideoResponse.arrayBuffer());
                               const uploadedMerged = await uploadBuffer({ 
                  buffer: mergedVideoBuffer, 
                  contentType: "video/mp4", 
                  ext: ".mp4", 
                  prefix: "videos"
                });

               console.log(`[worker:fallback] Merged video uploaded: ${uploadedMerged.url}`);
               await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "ffmpeg_merge_success", message: `Merged video uploaded: ${uploadedMerged.url}` } });

               // Update episode with merged video URL
               await prisma.episode.update({ where: { id: episodeId }, data: { videoUrl: uploadedMerged.url } });
             }
           } else {
             console.log(`[worker:fallback] FFMPEG merge failed:`, ffmpegResult);
             await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "ffmpeg_merge_failed", message: `FFMPEG merge failed: ${JSON.stringify(ffmpegResult)}` } });
           }
         } catch (mergeError: any) {
           console.log(`[worker:fallback] FFMPEG merge error:`, mergeError.message);
           await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "ffmpeg_merge_error", message: `FFMPEG merge error: ${mergeError.message}` } });
         }
       }
     }

     // Calculate total duration from all parts
     let totalDurationSec = 0;
     for (const part of videoParts) {
       try {
         const partUrl = part.audioUrl.startsWith("http") ? part.audioUrl : `${base}${part.audioUrl}`;
         const response = await fetch(partUrl);
         if (response.ok) {
           const buffer = Buffer.from(await response.arrayBuffer());
           const meta = await parseBuffer(buffer, "audio/mpeg");
           if (meta.format.duration) {
             totalDurationSec += Math.round(meta.format.duration);
           }
         }
       } catch {}
     }

     // Update episode with final data
     await prisma.episode.update({
       where: { id: episodeId },
       data: {
         status: "PUBLISHED" as any,
         title: script.title,
         ssml: script.ssml,
         estimatedWpm: script.estimated_wpm,
         chaptersJson: script.chapters as any,
         showNotesMd: script.show_notes,
         audioUrl: videoParts[0]?.audioUrl || "", // Use first part as main audio
         durationSec: totalDurationSec || 60,
       },
     });

     console.log(`[worker:fallback] Episode ${episodeId} completed with ${videoParts.length} parts`);
     await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "publish_done", message: `Episode completed with ${videoParts.length} parts` } });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error(`[worker:fallback] Failed episode ${episodeId}`, e);
    await prisma.episode.update({ where: { id: episodeId }, data: { status: "FAILED" as any, errorMessage: e.message } });
    await prisma.eventLog.create({ data: { episodeId, userId: ep.userId, type: "error", message: e.message?.toString() || "Unknown error" } });
  }
}


