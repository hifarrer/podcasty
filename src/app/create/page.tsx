"use client";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Mic, Youtube } from "lucide-react";

type SourceType = "YOUTUBE" | "PROMPT";
type Mode = "SUMMARY" | "READTHROUGH" | "DISCUSSION";
type Episode = {
  id: string;
  title?: string | null;
  audioUrl?: string | null;
  videoUrl?: string | null;
  coverUrl?: string | null;
  showNotesMd?: string | null;
};

export default function CreateEpisodePage() {
  const [sourceType, setSourceType] = useState<SourceType>("PROMPT");
  const [sourceUrl, setSourceUrl] = useState("");
  const [promptText, setPromptText] = useState("");
  const [mode, setMode] = useState<Mode>("SUMMARY");
  const [targetMinutes, setTargetMinutes] = useState(1);
  const [includeIntro, setIncludeIntro] = useState(true);
  const [includeOutro, setIncludeOutro] = useState(false);
  const [chaptersEnabled, setChaptersEnabled] = useState(false);
  const [voiceId, setVoiceId] = useState<string>("");
  const [voiceIdB, setVoiceIdB] = useState<string>("");
  const [voices, setVoices] = useState<{ voice_id: string; name: string; preview_url?: string | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [generateVideo, setGenerateVideo] = useState<boolean>(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [episode, setEpisode] = useState<Episode | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const lastStatusRef = useRef<string | null>(null);
  const pollMsRef = useRef<number>(3000);
  const { data: session, status: sessionStatus } = useSession();

  // Character images
  const [characterA, setCharacterA] = useState<string>("");
  const [gallery, setGallery] = useState<{ id: string; url: string; type: string }[]>([]);
  const [showGalleryFor, setShowGalleryFor] = useState<"A" | "B" | null>(null);
  const [showPromptFor, setShowPromptFor] = useState<"A" | "B" | null>(null);
  const [galleryTab, setGalleryTab] = useState<"MY" | "PUBLIC">("MY");
  const fileInputARef = useRef<HTMLInputElement | null>(null);
  const [promptTextModal, setPromptTextModal] = useState<string>("");
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptGeneratedUrl, setPromptGeneratedUrl] = useState<string>("");

  // Effects must be declared before any early returns
  useEffect(() => {
    // Load voices on mount
    (async () => {
      try {
        const r = await fetch("/api/voices", { 
          cache: "no-store",
          credentials: "include"
        });
        const d = await r.json();
        if (Array.isArray(d.voices)) {
          setVoices(d.voices);
          if (!voiceId && d.voices.length > 0) setVoiceId(d.voices[0].voice_id);
          if (!voiceIdB && d.voices.length > 1) setVoiceIdB(d.voices[1].voice_id);
        }
      } catch {}
    })();
    if (!createdId) return;
    // Clear any previous poller
    if (pollRef.current) clearInterval(pollRef.current);
    const poll = async () => {
      try {
        const res = await fetch(`/api/episodes/${createdId}/status?ts=${Date.now()}`, { 
          cache: "no-store",
          credentials: "include"
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Status error");
        if (data.status !== lastStatusRef.current) {
          console.log("Status changed", { status: data.status, episodeId: createdId });
          lastStatusRef.current = data.status;
        }
        setStatus(data.status);
        setEpisode(data.episode);
        if (data.status === "FAILED") {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
        } else if (data.status === "PUBLISHED" && data.episode?.videoUrl) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
        } else if (data.status === "PUBLISHED" && !data.episode?.videoUrl) {
          // Continue polling for video results every 10 seconds
          if (pollMsRef.current !== 10000) {
            if (pollRef.current) clearInterval(pollRef.current);
            pollMsRef.current = 10000;
            pollRef.current = setInterval(poll, pollMsRef.current);
          }
        }
      } catch (e) {
        // keep polling on transient failures
      }
    };
    // kick immediately, then every 3s (can change to 10s while waiting for video)
    poll();
    pollMsRef.current = 3000;
    pollRef.current = setInterval(poll, pollMsRef.current);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [createdId, voiceId, voiceIdB]);

  // Load media gallery on mount
  useEffect(() => {
    (async () => {
      try {
        if (sessionStatus !== "authenticated" || !session) return;
        const r = await fetch("/api/media", { cache: "no-store", credentials: "include" });
        if (!r.ok) return; // likely unauthenticated
        const d = await r.json();
        if (Array.isArray(d.media)) setGallery(d.media);
      } catch {}
    })();
  }, [sessionStatus, session]);

  // Check if user is authenticated
  if (sessionStatus === "loading") {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00c8c8] mx-auto mb-4"></div>
          <p className="text-[#cccccc]">Loading...</p>
        </div>
      </div>
    );
  }

  if (sessionStatus === "unauthenticated" || !session) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <h1 className="text-3xl font-bold text-white mb-4">Authentication Required</h1>
          <p className="text-[#cccccc] mb-8">
            You need to be logged in to create podcast episodes. Please sign in or create an account to continue.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login" className="btn-primary px-6 py-3">
              Sign In
            </Link>
            <Link href="/register" className="btn-secondary px-6 py-3">
              Create Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Function to get progress percentage and status message
  function getProgressInfo(status: string | null) {
    switch (status) {
      case "CREATED":
        return { progress: 10, message: "Episode created", step: "Initializing..." };
      case "PROCESSING": // legacy label
      case "INGESTING":
        return { progress: 30, message: "Processing content", step: "Analyzing content..." };
      case "GENERATING_SCRIPT": // legacy label
      case "SCRIPTING":
        return { progress: 50, message: "Generating script", step: "Writing episode script..." };
      case "SYNTHESIZING":
        return { progress: 70, message: "Synthesizing audio", step: "Creating voice audio..." };
      case "POST_PROCESSING": // legacy label
      case "AUDIO_POST":
        return { progress: 85, message: "Post-processing", step: "Finalizing audio..." };
      case "VIDEO_RENDER":
        return { progress: 95, message: "Rendering video", step: "Creating lipsync video..." };
      case "PUBLISHED":
        return { progress: 100, message: "Complete!", step: "Episode ready!" };
      case "FAILED":
        return { progress: 0, message: "Failed", step: "Generation failed" };
      default:
        return { progress: 0, message: "Starting...", step: "Preparing..." };
    }
  }

  async function submit() {
    setLoading(true);
    try {
      if (generateVideo && !characterA) {
        throw new Error("Character is Required to generate a video. Please upload an image, select from gallery, or generate with a prompt.");
      }
              const res = await fetch("/api/episodes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            sourceType,
            sourceUrl: sourceType === "YOUTUBE" ? (sourceUrl || undefined) : undefined,
            promptText: sourceType === "PROMPT" ? promptText : undefined,
            mode,
            targetMinutes,
            includeIntro,
            includeOutro,
            chaptersEnabled,
            isPublic,
            generateVideo,
            speakers: mode === "DISCUSSION" ? 2 : 1,
            voices: mode === "DISCUSSION" ? [voiceId, voiceIdB].filter(Boolean) : [voiceId].filter(Boolean),
            speakerNames: mode === "DISCUSSION" ? {
              A: voices.find((v) => v.voice_id === voiceId)?.name || undefined,
              B: voices.find((v) => v.voice_id === voiceIdB)?.name || undefined,
            } : undefined,
            coverUrl: generateVideo ? (characterA || undefined) : undefined,
          }),
        });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setCreatedId(data.id);
      setStatus("CREATED");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed";
      alert(message);
    } finally {
      setLoading(false);
    }
  }

  

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl lg:text-5xl font-bold gradient-text mb-4">
            Create Your Podcast Episode
          </h1>
          <p className="text-xl text-[#cccccc] max-w-2xl mx-auto">
            Transform any content into a professional podcast episode with AI-powered voice synthesis and intelligent scripting.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-8">
            {/* Episode Configuration */}
            <div className="card">
              <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-r from-[#00c8c8] to-[#007bff] rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                Episode Settings
              </h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-[#cccccc] mb-3">Mode</label>
                  <select 
                    className="select-field w-full" 
                    value={mode} 
                    onChange={(e) => setMode(e.target.value as Mode)}
                    disabled={generateVideo && mode === "DISCUSSION"}
                  >
                    <option value="SUMMARY">Summary</option>
                    <option value="READTHROUGH">Read-through</option>
                    <option value="DISCUSSION" disabled={generateVideo}>Discussion</option>
                  </select>
                  {generateVideo && mode === "DISCUSSION" && (
                    <p className="text-xs text-[#ff6b6b] mt-1">Video generation only allows 1 character</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#cccccc] mb-3">
                    Target Minutes: {targetMinutes} min
                  </label>
                  <div className="space-y-2">
                    <input
                      type="range"
                      className="w-full h-2 bg-[#333333] rounded-lg appearance-none cursor-pointer slider"
                      value={targetMinutes}
                      onChange={(e) => {
                        const value = parseInt(e.target.value, 10);
                        setTargetMinutes(value);
                      }}
                      min={1}
                      max={generateVideo ? 3 : 15}
                      step={1}
                    />
                    <div className="flex justify-between text-xs text-[#999999]">
                      <span>1 min</span>
                      <span>{generateVideo ? '3 min' : '15 min'}</span>
                    </div>
                    {generateVideo && (
                      <p className="text-xs text-[#f59e0b] mt-1">
                        ⚠️ Video generation is limited to 3 minutes maximum
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {/* Generate Video Toggle */}
                <div className="flex items-center justify-between p-4 rounded-lg border border-[#333333] bg-[#2a2a2a]/50">
                  <div>
                    <span className="text-[#cccccc] font-medium">Generate Video</span>
                    <p className="text-xs text-[#999999] mt-1">Create a lipsync video with your character</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newVideoState = !generateVideo;
                      setGenerateVideo(newVideoState);
                      // If enabling video generation and mode is DISCUSSION, change to SUMMARY
                      if (newVideoState && mode === "DISCUSSION") {
                        setMode("SUMMARY");
                      }
                      // Adjust target minutes if needed
                      if (newVideoState && targetMinutes > 3) {
                        setTargetMinutes(3);
                      }
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#00c8c8] focus:ring-offset-2 focus:ring-offset-[#1a1a1a] ${
                      generateVideo ? 'bg-[#00c8c8]' : 'bg-[#666666]'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        generateVideo ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>


              </div>
            </div>

            {/* Source Configuration */}
            <div className="card">
              <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-r from-[#00c8c8] to-[#007bff] rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                Content Source
              </h2>
              
              <div className="space-y-6">
                {/* Visibility */}
                <div>
                  <label className="block text-sm font-medium text-[#cccccc] mb-3">Visibility</label>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setIsPublic(true)}
                      className={`px-4 py-2 rounded-lg border-2 transition-all ${isPublic ? "border-[#00c8c8] bg-[#00c8c8]/10 text-white" : "border-[#333333] text-[#cccccc] hover:border-[#00c8c8]/50"}`}
                    >
                      Public
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPublic(false)}
                      className={`px-4 py-2 rounded-lg border-2 transition-all ${!isPublic ? "border-[#00c8c8] bg-[#00c8c8]/10 text-white" : "border-[#333333] text-[#cccccc] hover:border-[#00c8c8]/50"}`}
                    >
                      Private
                    </button>
                  </div>
                  <p className="text-xs text-[#999999] mt-2">Public episodes may appear on the site gallery.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#cccccc] mb-3">Source Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSourceType("PROMPT")}
                      className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all duration-200 ${
                        sourceType === "PROMPT"
                          ? "border-[#00c8c8] bg-[#00c8c8]/10"
                          : "border-[#333333] hover:border-[#00c8c8]/50 hover:bg-[#00c8c8]/5"
                      }`}
                    >
                      <Mic className={`w-6 h-6 ${sourceType === "PROMPT" ? "text-[#00c8c8]" : "text-[#cccccc]"}`} />
                      <span className={`text-sm font-medium ${sourceType === "PROMPT" ? "text-[#00c8c8]" : "text-[#cccccc]"}`}>
                        Text Prompt
                      </span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setSourceType("YOUTUBE")}
                      className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all duration-200 ${
                        sourceType === "YOUTUBE"
                          ? "border-[#00c8c8] bg-[#00c8c8]/10"
                          : "border-[#333333] hover:border-[#00c8c8]/50 hover:bg-[#00c8c8]/5"
                      }`}
                    >
                      <Youtube className={`w-6 h-6 ${sourceType === "YOUTUBE" ? "text-[#00c8c8]" : "text-[#cccccc]"}`} />
                      <span className={`text-sm font-medium ${sourceType === "YOUTUBE" ? "text-[#00c8c8]" : "text-[#cccccc]"}`}>
                        YouTube
                      </span>
                    </button>
                  </div>
                </div>

                {sourceType === "YOUTUBE" && (
                  <div>
                    <label className="block text-sm font-medium text-[#cccccc] mb-3">
                      {sourceType === "YOUTUBE" ? "YouTube URL" : "Web URL"}
                    </label>
                    <input
                      className="input-field w-full"
                      placeholder={
                        sourceType === "YOUTUBE"
                          ? "https://youtube.com/watch?v=..."
                          : "https://en.wikipedia.org/wiki/Harrison_Ford"
                      }
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                    />
                  </div>
                )}



                {sourceType === "PROMPT" && (
                  <div>
                    <label className="block text-sm font-medium text-[#cccccc] mb-3">Text Prompt</label>
                    <textarea
                      className="input-field w-full h-32 resize-none"
                      placeholder="A Podcast about Clean Energy"
                      value={promptText}
                       onChange={(e) => {
                         const v = e.target.value;
                         if (v.length <= 35000) setPromptText(v);
                       }}
                    />
                    <div className="text-xs text-[#999999] mt-1">{promptText.length}/35000</div>
                  </div>
                )}
              </div>
            </div>

            {/* Voice Selection */}
            <div className="card">
              <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-r from-[#00c8c8] to-[#007bff] rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                Voice Selection
              </h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-[#cccccc] mb-3">Voice A</label>
                  <select className="select-field w-full" value={voiceId} onChange={(e) => setVoiceId(e.target.value)}>
                    {voices.map((v) => (
                      <option key={v.voice_id} value={v.voice_id}>{v.name}</option>
                    ))}
                  </select>
                  {voices.find((v) => v.voice_id === voiceId)?.preview_url && (
                    <div className="mt-3">
                      <audio key={voiceId} controls className="w-full" preload="none">
                        <source src={voices.find((v) => v.voice_id === voiceId)!.preview_url as string} />
                      </audio>
                    </div>
                  )}
                </div>
                
                {mode === "DISCUSSION" && (
                  <div>
                    <label className="block text-sm font-medium text-[#cccccc] mb-3">Voice B</label>
                    <select className="select-field w-full" value={voiceIdB} onChange={(e) => setVoiceIdB(e.target.value)}>
                      {voices.map((v) => (
                        <option key={v.voice_id} value={v.voice_id}>{v.name}</option>
                      ))}
                    </select>
                    {voiceIdB && voices.find((v) => v.voice_id === voiceIdB)?.preview_url && (
                      <div className="mt-3">
                        <audio key={voiceIdB} controls className="w-full" preload="none">
                          <source src={voices.find((v) => v.voice_id === voiceIdB)!.preview_url as string} />
                        </audio>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={submit}
              disabled={loading}
              className="btn-primary w-full text-lg py-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="inline-flex items-center gap-3">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating Episode...
                </span>
              ) : (
                "Generate Episode"
              )}
            </button>

            {/* Generation Status */}
            {createdId && (
              <div className="card">
                <h3 className="text-xl font-semibold text-white mb-4">Generation Status</h3>
                
                {status !== "PUBLISHED" && status !== "FAILED" && (
                  <div className="space-y-6">
                    {(() => {
                      const { progress, message, step } = getProgressInfo(status);
                      return (
                        <>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-[#cccccc]">{message}</span>
                              <span className="text-sm font-bold text-[#00c8c8]">{progress}%</span>
                            </div>
                            <div className="w-full bg-[#2a2a2a] rounded-full h-2 overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-[#00c8c8] to-[#007bff] rounded-full transition-all duration-1000 ease-out"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-[#00c8c8] rounded-full animate-pulse"></div>
                            <span className="text-sm text-[#999999]">{step}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {status === "FAILED" && (
                  <div className="text-[#ef4444] bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-lg p-4">
                    <div className="font-medium">Generation failed</div>
                    <div className="text-sm mt-1">Please try again or check your input.</div>
                  </div>
                )}

                {status === "PUBLISHED" && episode && (
                  <div className="space-y-4">
                    {episode.videoUrl ? (
                      <div className="text-[#66cc66] bg-[#66cc66]/10 border border-[#66cc66]/20 rounded-lg p-4">
                        <div className="font-medium">Episode Complete!</div>
                        <div className="text-sm mt-1">Your podcast is ready to listen and watch.</div>
                      </div>
                    ) : (episode as any).generateVideo ? (
                      <div className="text-[#f59e0b] bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded-lg p-4 flex items-center gap-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#f59e0b]"></div>
                        <div>
                          <div className="font-medium">Audio Complete! Generating video...</div>
                          <div className="text-sm mt-1">Video is still generating, please be patient. It could take up to 15 minutes to generate.</div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[#66cc66] bg-[#66cc66]/10 border border-[#66cc66]/20 rounded-lg p-4">
                        <div className="font-medium">Audio Complete!</div>
                        <div className="text-sm mt-1">Your podcast is ready to listen.</div>
                      </div>
                    )}
                    
                    <div className="space-y-3">
                      <div className="text-lg font-semibold text-white">{episode.title || "Episode"}</div>
                      {episode.videoUrl ? (
                        <video controls className="w-full" preload="metadata" poster={episode.coverUrl || undefined}>
                          <source src={episode.videoUrl} />
                        </video>
                      ) : episode.audioUrl ? (
                        <audio controls className="w-full">
                          <source src={episode.audioUrl} type="audio/mpeg" />
                        </audio>
                      ) : null}
                    </div>

                    {/* Save Option */}
                    {session ? (
                      <div className="space-y-3">
                        <button className="btn-secondary w-full py-3">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Save to My Episodes
                        </button>
                        <p className="text-xs text-[#999999] text-center">
                          This episode will be saved to your account
                        </p>
                      </div>
                    ) : (
                      <div className="text-center space-y-3">
                        <div className="text-[#f59e0b] bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded-lg p-4">
                          <div className="font-medium">Create an Account</div>
                          <div className="text-sm mt-1">To save this podcast, please create an account</div>
                        </div>
                        <div className="flex gap-2">
                          <Link href="/register" className="btn-primary flex-1 py-2 text-sm">
                            Sign Up
                          </Link>
                          <Link href="/login" className="btn-secondary flex-1 py-2 text-sm">
                            Sign In
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="text-xs text-[#666666] mt-4 pt-4 border-t border-[#333333]">
                  Episode ID: {createdId}
                </div>
              </div>
            )}
          </div>

          {/* Gallery Modal */}
          {showGalleryFor && (
            <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
              <div className="bg-[#1f1f1f] border border-[#333] rounded-lg max-w-3xl w-full max-h-[80vh] overflow-auto p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl text-white font-semibold">Select from Gallery</h3>
                  <button className="text-[#cccccc] hover:text-white" onClick={() => setShowGalleryFor(null)}>Close</button>
                </div>
                <div className="mb-4 flex items-center gap-2">
                  <button
                    className={`px-3 py-1 rounded ${galleryTab === "MY" ? "bg-[#00c8c8] text-white" : "bg-[#2a2a2a] text-[#cccccc]"}`}
                    onClick={() => setGalleryTab("MY")}
                  >
                    My Images
                  </button>
                  <button
                    className={`px-3 py-1 rounded ${galleryTab === "PUBLIC" ? "bg-[#00c8c8] text-white" : "bg-[#2a2a2a] text-[#cccccc]"}`}
                    onClick={() => setGalleryTab("PUBLIC")}
                  >
                    Public Images
                  </button>
                </div>
                {galleryTab === "MY" ? (
                  gallery.length === 0 ? (
                    <div className="text-[#999]">You have not generated any images yet, you can try to generate your own or select from the Public Images.</div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {gallery.filter(g => g.type === "image").map(g => (
                        <button key={g.id} type="button" className="block" onClick={() => {
                          setCharacterA(g.url);
                          setShowGalleryFor(null);
                        }}>
                          <img src={g.url} className="w-full h-32 object-cover rounded border border-[#333]" />
                        </button>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {Array.from({ length: 14 }).map((_, i) => {
                      const url = `/assets/images/p${i + 1}.jpg`;
                      return (
                        <button key={url} type="button" className="block" onClick={() => {
                          setCharacterA(url);
                          setShowGalleryFor(null);
                        }}>
                          <img src={url} className="w-full h-32 object-cover rounded border border-[#333]" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Prompt Modal */}
          {showPromptFor && (
            <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
              <div className="bg-[#1f1f1f] border border-[#333] rounded-lg max-w-xl w-full p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl text-white font-semibold">Describe with Prompt</h3>
                  <button className="text-[#cccccc] hover:text-white" onClick={() => { setShowPromptFor(null); setPromptTextModal(""); setPromptGeneratedUrl(""); }}>Close</button>
                </div>
                <textarea className="input-field w-full h-28 resize-none" placeholder="A realistic headshot, soft lighting, 3/4 view"
                  value={promptTextModal} onChange={(e) => setPromptTextModal(e.target.value)} />
                <div className="flex gap-2">
                  <button disabled={promptLoading || !promptTextModal.trim()} className="btn-primary disabled:opacity-50" onClick={async () => {
                    try {
                      setPromptLoading(true);
                      setPromptGeneratedUrl("");
                      const previewBody = { prompt: promptTextModal, aspect_ratio: "16:9" };
                      console.log("[FAL] Submitting preview", { url: "/api/fal/imagen4/preview", method: "POST", headers: { "Content-Type": "application/json" }, body: previewBody });
                      const r = await fetch("/api/fal/imagen4/preview", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(previewBody) });
                      const d = await r.json();
                      console.log("[FAL] Preview response", { status: r.status, body: d });
                      if (!r.ok) { alert(d.error || "FAL submit failed"); return; }
                      const reqId = d.request_id;
                      for (let i = 0; i < 60; i++) {
                        await new Promise(res => setTimeout(res, 2000));
                        const statusUrl = `/api/fal/imagen4/requests/${encodeURIComponent(reqId)}/status`;
                        const s = await fetch(statusUrl, { credentials: "include" });
                        const sd = await s.json();
                        if (i === 0) {
                          console.log("[FAL] Status polling started", { url: statusUrl });
                        }
                        if (sd?.status === "COMPLETED" || sd?.status === "completed") {
                          console.log("[FAL] Status response", { url: statusUrl, status: s.status, body: sd });
                        }
                        if (sd?.status === "COMPLETED" || sd?.status === "completed") {
                          const resultUrl = `/api/fal/imagen4/requests/${encodeURIComponent(reqId)}?save=1`;
                          console.log("[FAL] Fetching result", { url: resultUrl });
                          const rr = await fetch(resultUrl, { credentials: "include" });
                          const rd = await rr.json();
                          console.log("[FAL] Result response", { status: rr.status, body: rd });
                          const url = rd?.saved?.url || rd?.imageUrl || rd?.data?.image?.url || rd?.data?.image_url;
                          if (url) {
                            setPromptGeneratedUrl(url);
                            // Attempt to add to gallery immediately if authenticated
                            try {
                              if (session) {
                                // If server already saved with DB id, skip duplicate import
                                const savedId = rd?.saved?.id;
                                if (!savedId || savedId === "anon") {
                                  await fetch("/api/media", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ url }) });
                                }
                                // Refresh gallery
                                const gr = await fetch("/api/media", { credentials: "include" });
                                if (gr.ok) {
                                  const gd = await gr.json();
                                  if (Array.isArray(gd.media)) setGallery(gd.media);
                                }
                              }
                            } catch {}
                          }
                          break;
                        }
                      }
                    } catch (err) {
                      console.error("[FAL] Generate error", err);
                      alert("Image generation failed. Check console for details.");
                    } finally {
                      setPromptLoading(false);
                    }
                  }}>{promptLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating...
                    </span>
                  ) : (
                    "Generate"
                  )}</button>
                  {promptGeneratedUrl && (
                    <button className="btn-secondary" onClick={() => { setPromptGeneratedUrl(""); }}>Regenerate</button>
                  )}
                </div>
                {promptGeneratedUrl && (
                  <div className="space-y-3">
                    <img src={promptGeneratedUrl} className="w-full h-64 object-cover rounded border border-[#333]" />
                    <div className="flex gap-2">
                      <button className="btn-primary" onClick={() => {
                        setCharacterA(promptGeneratedUrl);
                        setShowPromptFor(null);
                        setPromptTextModal("");
                        setPromptGeneratedUrl("");
                      }}>Use this image</button>
                      <button className="btn-secondary" onClick={() => { setPromptGeneratedUrl(""); }}>Regenerate</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Right Sidebar */}
          <div className="lg:col-span-1 space-y-8">
            {/* Characters */}
            {generateVideo && (
              <div className="card">
                <h2 className="text-2xl font-semibold text-white mb-6">Character</h2>
                <div className="grid md:grid-cols-1 gap-8">
                  <div>
                    <div className="text-[#cccccc] mb-2 font-medium">Character</div>
                    <div className="space-y-3">
                      {characterA ? (
                        <img src={characterA} alt="Character A" className="w-full h-40 object-cover rounded" />
                      ) : (
                        <div className="w-full h-40 border-2 border-dashed border-[#666666] rounded flex items-center justify-center">
                          <div className="text-center">
                            <svg className="w-8 h-8 text-[#666666] mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <p className="text-[#666666] text-sm">Character Required</p>
                            <p className="text-[#999999] text-xs">Upload, select, or generate an image</p>
                          </div>
                        </div>
                      )}
                      <div className="flex flex-col gap-2">
                        <button type="button" className="btn-secondary w-full flex items-center justify-center" onClick={() => fileInputARef.current?.click()}>
                          <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          Upload Image
                        </button>
                        <button type="button" className="btn-secondary w-full flex items-center justify-center" onClick={() => setShowGalleryFor("A")}>
                          <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                          Select from Gallery
                        </button>
                        <button type="button" className="btn-secondary w-full flex items-center justify-center" onClick={() => setShowPromptFor("A")}>
                          <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Describe with Prompt
                        </button>
                        <input ref={fileInputARef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          const fd = new FormData();
                          fd.append("file", f);
                          const r = await fetch("/api/uploads", { method: "POST", body: fd, credentials: "include" });
                          const d = await r.json();
                          if (!r.ok) { alert(d.error || "Upload failed"); return; }
                          setCharacterA(d.url);
                          try { const gr = await fetch("/api/media", { credentials: "include" }); const gd = await gr.json(); if (gd.media) setGallery(gd.media); } catch {}
                        }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            
          </div>
        </div>

        {/* Show Notes */}
        {status === "PUBLISHED" && episode?.showNotesMd && (
          <div className="mt-12 card">
            <h2 className="text-2xl font-semibold text-white mb-6">Show Notes</h2>
            <div className="prose prose-invert max-w-none">
              <ReactMarkdown>{episode.showNotesMd}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


