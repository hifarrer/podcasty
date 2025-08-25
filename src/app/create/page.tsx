"use client";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Mic, Youtube, Globe, FileText } from "lucide-react";

type SourceType = "YOUTUBE" | "WEB" | "PDF" | "TXT" | "PROMPT";
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
  const [uploadKey, setUploadKey] = useState("");
  const [promptText, setPromptText] = useState("");
  const [mode, setMode] = useState<Mode>("SUMMARY");
  const [targetMinutes, setTargetMinutes] = useState(1);
  const [includeIntro, setIncludeIntro] = useState(true);
  const [includeOutro, setIncludeOutro] = useState(true);
  const [chaptersEnabled, setChaptersEnabled] = useState(true);
  const [voiceId, setVoiceId] = useState<string>("");
  const [voiceIdB, setVoiceIdB] = useState<string>("");
  const [voices, setVoices] = useState<{ voice_id: string; name: string; preview_url?: string | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [episode, setEpisode] = useState<Episode | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const lastStatusRef = useRef<string | null>(null);
  const { data: session, status: sessionStatus } = useSession();

  // Character images
  const [characterA, setCharacterA] = useState<string>("");
  const [gallery, setGallery] = useState<{ id: string; url: string; type: string }[]>([]);
  const [showGalleryFor, setShowGalleryFor] = useState<"A" | "B" | null>(null);
  const [showPromptFor, setShowPromptFor] = useState<"A" | "B" | null>(null);
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
        if (data.status === "PUBLISHED" || data.status === "FAILED") {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch (e) {
        // keep polling on transient failures
      }
    };
    // kick immediately, then every 3s
    poll();
    pollRef.current = setInterval(poll, 3000);
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
      if (!characterA) {
        throw new Error("Please add Character 1 image.");
      }
      const res = await fetch("/api/episodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sourceType,
          sourceUrl: (sourceType === "YOUTUBE" || sourceType === "WEB") ? (sourceUrl || undefined) : undefined,
          promptText: sourceType === "PROMPT" ? promptText : undefined,
          uploadKey: sourceType === "TXT" ? (uploadKey || undefined) : undefined,
          mode,
          targetMinutes,
          includeIntro,
          includeOutro,
          chaptersEnabled,
          isPublic,
          speakers: mode === "DISCUSSION" ? 2 : 1,
          voices: mode === "DISCUSSION" ? [voiceId, voiceIdB].filter(Boolean) : [voiceId].filter(Boolean),
          speakerNames: mode === "DISCUSSION" ? {
            A: voices.find((v) => v.voice_id === voiceId)?.name || undefined,
            B: voices.find((v) => v.voice_id === voiceIdB)?.name || undefined,
          } : undefined,
          coverUrl: characterA || undefined,
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
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                    
                    <button
                      type="button"
                      onClick={() => setSourceType("WEB")}
                      className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all duration-200 ${
                        sourceType === "WEB"
                          ? "border-[#00c8c8] bg-[#00c8c8]/10"
                          : "border-[#333333] hover:border-[#00c8c8]/50 hover:bg-[#00c8c8]/5"
                      }`}
                    >
                      <Globe className={`w-6 h-6 ${sourceType === "WEB" ? "text-[#00c8c8]" : "text-[#cccccc]"}`} />
                      <span className={`text-sm font-medium ${sourceType === "WEB" ? "text-[#00c8c8]" : "text-[#cccccc]"}`}>
                        Web
                      </span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setSourceType("TXT")}
                      className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all duration-200 ${
                        sourceType === "TXT"
                          ? "border-[#00c8c8] bg-[#00c8c8]/10"
                          : "border-[#333333] hover:border-[#00c8c8]/50 hover:bg-[#00c8c8]/5"
                      }`}
                    >
                      <FileText className={`w-6 h-6 ${sourceType === "TXT" ? "text-[#00c8c8]" : "text-[#cccccc]"}`} />
                      <span className={`text-sm font-medium ${sourceType === "TXT" ? "text-[#00c8c8]" : "text-[#cccccc]"}`}>
                        TXT File
                      </span>
                    </button>
                  </div>
                </div>

                {(sourceType === "YOUTUBE" || sourceType === "WEB") && (
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

                {sourceType === "TXT" && (
                  <div>
                    <label className="block text-sm font-medium text-[#cccccc] mb-3">Upload TXT File</label>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const input = (e.currentTarget.elements.namedItem("file") as HTMLInputElement) || null;
                        if (!input || !input.files || input.files.length === 0) return;
                        const fd = new FormData();
                        fd.append("file", input.files[0]);
                        const res = await fetch("/api/uploads", { 
                          method: "POST", 
                          credentials: "include",
                          body: fd 
                        });
                        const data = await res.json();
                        if (!res.ok) {
                          alert(data.error || "Upload failed");
                          return;
                        }
                        setUploadKey(data.key);
                        alert("TXT uploaded successfully!");
                      }}
                      className="flex items-center gap-3"
                    >
                      <input 
                        name="file" 
                        type="file" 
                        accept=".txt,text/plain" 
                        className="block flex-1 text-[#cccccc] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#00c8c8] file:text-white hover:file:opacity-80 transition-opacity" 
                      />
                      <button type="submit" className="btn-primary text-sm px-4 py-2">
                        Upload
                      </button>
                    </form>
                    {uploadKey && (
                      <div className="mt-3 text-sm text-[#66cc66] flex items-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        File uploaded successfully
                      </div>
                    )}
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

            {/* Characters */}
            <div className="card">
              <h2 className="text-2xl font-semibold text-white mb-6">Characters</h2>
              <div className="grid md:grid-cols-1 gap-8">
                <div>
                  <div className="text-[#cccccc] mb-2 font-medium">Character</div>
                  <div className="space-y-3">
                    {characterA && (
                      <img src={characterA} alt="Character A" className="w-full h-40 object-cover rounded" />
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn-secondary" onClick={() => fileInputARef.current?.click()}>Upload Image</button>
                      <button type="button" className="btn-secondary" onClick={() => setShowGalleryFor("A")}>Select from Gallery</button>
                      <button type="button" className="btn-primary" onClick={() => setShowPromptFor("A")}>Describe with Prompt</button>
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
                  <select className="select-field w-full" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                    <option value="SUMMARY">Summary</option>
                    <option value="READTHROUGH">Read-through</option>
                    <option value="DISCUSSION">Discussion</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#cccccc] mb-3">Target Minutes</label>
                  <input
                    type="number"
                    className="input-field w-full"
                    value={targetMinutes}
                    onChange={(e) => {
                      const n = parseInt(e.target.value || "0", 10);
                      setTargetMinutes(Math.min(40, Math.max(1, isNaN(n) ? 1 : n)));
                    }}
                    min={1}
                    max={40}
                  />
                </div>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-4">
                <label className="flex items-center gap-3 p-3 rounded-lg border border-[#333333] hover:border-[#00c8c8] transition-colors cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={includeIntro} 
                    onChange={(e) => setIncludeIntro(e.target.checked)}
                    className="w-4 h-4 text-[#00c8c8] bg-[#2a2a2a] border-[#333333] rounded focus:ring-[#00c8c8] focus:ring-2"
                  />
                  <span className="text-[#cccccc] font-medium">Intro</span>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg border border-[#333333] hover:border-[#00c8c8] transition-colors cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={includeOutro} 
                    onChange={(e) => setIncludeOutro(e.target.checked)}
                    className="w-4 h-4 text-[#00c8c8] bg-[#2a2a2a] border-[#333333] rounded focus:ring-[#00c8c8] focus:ring-2"
                  />
                  <span className="text-[#cccccc] font-medium">Outro</span>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-lg border border-[#333333] hover:border-[#00c8c8] transition-colors cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={chaptersEnabled} 
                    onChange={(e) => setChaptersEnabled(e.target.checked)}
                    className="w-4 h-4 text-[#00c8c8] bg-[#2a2a2a] border-[#333333] rounded focus:ring-[#00c8c8] focus:ring-2"
                  />
                  <span className="text-[#cccccc] font-medium">Chapters</span>
                </label>
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
          </div>

          {/* Gallery Modal */}
          {showGalleryFor && (
            <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
              <div className="bg-[#1f1f1f] border border-[#333] rounded-lg max-w-3xl w-full max-h-[80vh] overflow-auto p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl text-white font-semibold">Select from Gallery</h3>
                  <button className="text-[#cccccc] hover:text-white" onClick={() => setShowGalleryFor(null)}>Close</button>
                </div>
                {gallery.length === 0 ? (
                  <div className="text-[#999]">Your gallery is empty. Upload or generate an image first.</div>
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
                  }}>{promptLoading ? "Generating..." : "Generate"}</button>
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

          {/* Status Panel */}
          <div className="lg:col-span-1">
            {createdId && (
              <div className="card sticky top-24">
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
                    <div className="text-[#66cc66] bg-[#66cc66]/10 border border-[#66cc66]/20 rounded-lg p-4">
                      <div className="font-medium">Episode Complete!</div>
                      <div className="text-sm mt-1">Your podcast is ready to listen.</div>
                    </div>
                    
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


