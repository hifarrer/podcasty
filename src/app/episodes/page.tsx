"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Episode {
  id: string;
  title?: string;
  status: string;
  createdAt: string;
  targetMinutes?: number;
  mode?: string;
  audioUrl?: string;
  videoUrl?: string;
  coverUrl?: string;
}

function getStatusColor(status: string) {
  switch (status) {
    case "PUBLISHED":
      return "bg-[#66cc66] text-white";
    case "FAILED":
      return "bg-[#ef4444] text-white";
    case "PROCESSING":
      return "bg-[#00c8c8] text-white";
    case "CREATED":
      return "bg-[#007bff] text-white";
    default:
      return "bg-[#666666] text-white";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "PUBLISHED":
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      );
    case "FAILED":
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      );
    case "PROCESSING":
      return (
        <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      );
    case "CREATED":
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
      );
  }
}

export default function EpisodesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [debugMap, setDebugMap] = useState<Record<string, { open: boolean; loading: boolean; videos: string[]; audios: string[] }>>({});
  const [retrievingVideos, setRetrievingVideos] = useState<Record<string, boolean>>({});
  const [pollingEpisodes, setPollingEpisodes] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'videos' | 'audios'>('videos');
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; episodeId?: string; title?: string; loading: boolean }>({ open: false, loading: false });

  useEffect(() => {
    // Redirect to login if not authenticated
    if (status === "unauthenticated") {
      router.push("/login?message=Please sign in to view your episodes");
      return;
    }

    // Fetch episodes if authenticated
    if (status === "authenticated") {
      fetchEpisodes();
    }
  }, [status, router]);

  const fetchEpisodes = async () => {
    try {
      const res = await fetch("/api/episodes", {
        credentials: "include"
      });
      if (res.ok) {
        const data = await res.json();
        const newEpisodes = data.episodes || [];
        setEpisodes(newEpisodes);
        
        // Start polling for episodes that are processing
        newEpisodes.forEach((ep: Episode) => {
          if (ep.status === "PROCESSING" || ep.status === "SYNTHESIZING" || ep.status === "AUDIO_POST") {
            if (!pollingEpisodes.has(ep.id)) {
              console.log(`[BROWSER] Starting to poll episode ${ep.id} (status: ${ep.status})`);
              startPollingEpisode(ep.id);
            }
          }
        });
      } else if (res.status === 401) {
        // Redirect to login if unauthorized
        router.push("/login?message=Please sign in to view your episodes");
      }
    } catch (error) {
      console.error("Failed to fetch episodes:", error);
    } finally {
      setLoading(false);
    }
  };

  const videoEpisodes = episodes.filter(ep => !!ep.videoUrl);
  const audioEpisodes = episodes.filter(ep => !!ep.audioUrl && !ep.videoUrl);
  const episodesToShow = activeTab === 'videos' ? videoEpisodes : audioEpisodes;

  function openDeleteModal(ep: Episode) {
    setDeleteModal({ open: true, episodeId: ep.id, title: ep.title || 'Untitled Episode', loading: false });
  }

  async function confirmDelete() {
    if (!deleteModal.episodeId) return;
    setDeleteModal((m) => ({ ...m, loading: true }));
    try {
      const res = await fetch(`/api/episodes/${deleteModal.episodeId}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        setDeleteModal({ open: false, loading: false });
        await fetchEpisodes();
      } else {
        setDeleteModal({ open: false, loading: false });
        alert('Failed to delete episode.');
      }
    } catch {
      setDeleteModal({ open: false, loading: false });
      alert('Failed to delete episode.');
    }
  }

  const startPollingEpisode = (episodeId: string) => {
    setPollingEpisodes(prev => new Set(prev).add(episodeId));
    
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/episodes/${episodeId}/status`, {
          credentials: "include"
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`[BROWSER] Episode ${episodeId} status update:`, data.status);
          
          // Also fetch recent event logs to show detailed progress
          try {
            const eventsResponse = await fetch(`/api/episodes/${episodeId}/events`, {
              credentials: "include"
            });
            if (eventsResponse.ok) {
              const eventsData = await eventsResponse.json();
              if (Array.isArray(eventsData.events) && eventsData.events.length > 0) {
                const recentEvents = eventsData.events.slice(-3); // Show last 3 events
                recentEvents.forEach((event: any) => {
                  console.log(`[BROWSER] Episode ${episodeId} event: ${event.type} - ${event.message}`);
                });
              }
            }
          } catch (eventsError) {
            // Ignore events fetch errors
          }
          
          // Stop polling if episode is completed or failed
          if (data.status === "PUBLISHED" || data.status === "FAILED") {
            console.log(`[BROWSER] Episode ${episodeId} completed with status: ${data.status}`);
            clearInterval(pollInterval);
            setPollingEpisodes(prev => {
              const newSet = new Set(prev);
              newSet.delete(episodeId);
              return newSet;
            });
            
            // Refresh episodes list to show final state
            await fetchEpisodes();
          }
        }
      } catch (error) {
        console.error(`[BROWSER] Error polling episode ${episodeId}:`, error);
      }
    }, 5000); // Poll every 5 seconds
    
    // Store the interval ID to clear it later if needed
    return () => clearInterval(pollInterval);
  };

  async function toggleDebug(epId: string) {
    setDebugMap((m) => ({ ...m, [epId]: { ...(m[epId] || { open: false, loading: false, videos: [], audios: [] }), open: !(m[epId]?.open) } }));
    const state = debugMap[epId];
    if (!state || (!state.videos.length && !state.audios.length)) {
      setDebugMap((m) => ({ ...m, [epId]: { ...(m[epId] || { open: true, loading: false, videos: [], audios: [] }), loading: true } }));
      try {
        const r = await fetch(`/api/episodes/${epId}/events`, { credentials: "include" });
        const d = await r.json();
        const videos: string[] = [];
        const audios: string[] = [];
        if (Array.isArray(d.events)) {
          for (const ev of d.events) {
            const msg: string = ev?.message || "";
            const urlMatch = msg.match(/https?:[^\s)]+/g);
            if (urlMatch) {
              for (const u of urlMatch) {
                if (u.toLowerCase().endsWith(".mp4") || u.toLowerCase().includes("video")) videos.push(u);
                if (u.toLowerCase().endsWith(".mp3") || u.toLowerCase().includes("audio")) audios.push(u);
              }
            }
          }
        }
        setDebugMap((m) => ({ ...m, [epId]: { ...(m[epId] || { open: true, loading: false, videos: [], audios: [] }), loading: false, videos, audios } }));
      } catch {
        setDebugMap((m) => ({ ...m, [epId]: { ...(m[epId] || { open: true, loading: false, videos: [], audios: [] }), loading: false } }));
      }
    }
  }

  async function retrieveVideoFromWavespeed(epId: string) {
    console.log("[DEBUG] Starting video retrieval for episode:", epId);
    setRetrievingVideos(prev => ({ ...prev, [epId]: true }));
    let willRetry = false;
    try {
      const url = `/api/episodes/${epId}/retrieve-video`;
      console.log("[DEBUG] Making request to:", url);
      
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log("[DEBUG] Response status:", response.status);
      console.log("[DEBUG] Response headers:", Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        const result = await response.json();
        console.log("[DEBUG] Response body:", result);
        
        if (result.success) {
          console.log("[DEBUG] Video retrieval successful, refreshing episodes list");
          // Refresh the episodes list to show the new video
          await fetchEpisodes();
          alert('Video retrieved successfully!');
        } else if (result.status === 'processing' || result.status === 'created') {
          console.log(`[DEBUG] Video not ready yet (status=${result.status}). Retrying in 10s...`);
          willRetry = true;
          setTimeout(() => {
            retrieveVideoFromWavespeed(epId);
          }, 10_000);
        } else if (result.status === 'failed') {
          console.log("[DEBUG] Wavespeed reports failed:", result.error);
          alert(`Video generation failed: ${result.error || 'Unknown error'}`);
        } else {
          console.log("[DEBUG] Unexpected response:", result);
          alert('Failed to retrieve video. Please try again.');
        }
      } else {
        const errorText = await response.text();
        console.log("[DEBUG] Response not ok, error text:", errorText);
        
        // Try to parse the error response for debug info
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.debug) {
            console.log("[DEBUG] Detailed debug info:", errorData.debug);
          }
        } catch (e) {
          // If parsing fails, just log the raw text
        }
        
        alert('Failed to retrieve video. Please try again.');
      }
    } catch (error) {
      console.error('[DEBUG] Error retrieving video:', error);
      alert('Error retrieving video. Please try again.');
    } finally {
      if (!willRetry) {
        setRetrievingVideos(prev => ({ ...prev, [epId]: false }));
      }
    }
  }
  
  // Show loading state
  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-gradient-to-r from-[#00c8c8] to-[#007bff] rounded-lg animate-spin mx-auto mb-4"></div>
          <p className="text-[#cccccc]">Loading your episodes...</p>
        </div>
      </div>
    );
  }

  // Show authentication required message
  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 bg-gradient-to-r from-[#00c8c8] to-[#007bff] rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold gradient-text mb-4">Sign In Required</h1>
          <p className="text-[#cccccc] mb-8">
            Please sign in to view and manage your podcast episodes.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/login" className="btn-primary">
              Sign In
            </Link>
            <Link href="/register" className="btn-secondary">
              Create Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-4xl lg:text-5xl font-bold gradient-text mb-2">
              My Episodes
            </h1>
            <p className="text-xl text-[#cccccc]">
              {episodes.length} episode{episodes.length !== 1 ? 's' : ''} created
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={fetchEpisodes} className="btn-secondary">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            <Link href="/create" className="btn-primary">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Episode
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-8 flex items-center gap-2">
          <button
            onClick={() => setActiveTab('videos')}
            className={`px-4 py-2 rounded-lg border ${activeTab === 'videos' ? 'border-[#00c8c8] text-white' : 'border-[#2a2a2a] text-[#cccccc] hover:border-[#3a3a3a]'}`}
          >
            Videos ({videoEpisodes.length})
          </button>
          <button
            onClick={() => setActiveTab('audios')}
            className={`px-4 py-2 rounded-lg border ${activeTab === 'audios' ? 'border-[#00c8c8] text-white' : 'border-[#2a2a2a] text-[#cccccc] hover:border-[#3a3a3a]'}`}
          >
            Audios ({audioEpisodes.length})
          </button>
        </div>

        {episodesToShow.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-24 h-24 bg-gradient-to-r from-[#00c8c8] to-[#007bff] rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-white mb-4">No {activeTab === 'videos' ? 'videos' : 'audios'} yet</h2>
            <p className="text-[#cccccc] mb-8 max-w-md mx-auto">
              Create your first podcast episode to get started. Transform any content into professional audio with AI-powered voice synthesis.
            </p>
            <a href="/create" className="btn-primary text-lg px-8 py-4">
              Create Your First Episode
            </a>
          </div>
        ) : (
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {episodesToShow.map((ep) => (
              <div key={ep.id} className="card group hover:border-[#00c8c8] transition-all duration-300 overflow-hidden">
                <div className="flex items-start justify-between gap-4 mb-4 min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 min-w-0">
                      <h3 className="flex-1 min-w-0 truncate text-xl font-semibold text-white group-hover:text-[#00c8c8] transition-colors">
                        {ep.title || "Untitled Episode"}
                      </h3>
                      <div className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(ep.status)}`}>
                        {getStatusIcon(ep.status)}
                        {ep.status}
                        {pollingEpisodes.has(ep.id) && (
                          <svg className="w-3 h-3 animate-spin ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[#999999] min-w-0">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {new Date(ep.createdAt).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {ep.targetMinutes || 1} min target
                      </div>
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                        {ep.mode || 'SUMMARY'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    {ep.videoUrl && (
                      <a
                        href={ep.videoUrl}
                        download
                        className="btn-ghost p-2 hover:bg-[#222222] rounded-lg"
                        title="Download Video"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </a>
                    )}
                    {ep.audioUrl && (
                      <a 
                        href={ep.audioUrl} 
                        download
                        className="btn-ghost p-2 hover:bg-[#222222] rounded-lg"
                        title="Download Audio"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </a>
                    )}
                    <a 
                      href={`/share/${ep.id}`} 
                      className="btn-ghost p-2 hover:bg-[#222222] rounded-lg"
                      title="Share"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12v7a1 1 0 001 1h7m8-15l-7 7m0 0V5m0 7h7" />
                      </svg>
                    </a>
                    <button
                      onClick={() => openDeleteModal(ep)}
                      className="btn-ghost p-2 hover:bg-[#222222] rounded-lg"
                      title="Delete"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0a1 1 0 01-1-1V5a2 2 0 012-2h6a2 2 0 012 2v1a1 1 0 01-1 1H8z" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                {(ep.videoUrl || ep.audioUrl) && (
                  <div className="bg-[#2a2a2a] rounded-lg p-4 space-y-4">
                    {ep.videoUrl && (
                      <video
                        key={`${ep.id}-video`}
                        controls
                        className="w-full"
                        poster={ep.coverUrl || undefined}
                        preload="metadata"
                      >
                        <source src={ep.videoUrl} />
                      </video>
                    )}
                    {ep.audioUrl && (
                      <audio key={`${ep.id}-audio`} controls className="w-full" preload="metadata">
                        <source src={ep.audioUrl} type="audio/mpeg" />
                      </audio>
                    )}
                  </div>
                )}

                {debugMap[ep.id]?.open && (
                  <div className="mt-3 bg-[#1f1f1f] border border-[#333] rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold text-white">Generated Files (debug)</div>
                      {debugMap[ep.id]?.loading && <div className="text-xs text-[#999]">Loading...</div>}
                    </div>
                    <div className="grid md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-[#cccccc] mb-1">Part Videos</div>
                        <ul className="space-y-1">
                          {(debugMap[ep.id]?.videos || []).map((u, i) => (
                            <li key={`v-${i}`}>
                              <a className="text-[#00c8c8] hover:underline break-all" href={u} target="_blank" rel="noreferrer">{u}</a>
                            </li>
                          ))}
                          {(!debugMap[ep.id]?.videos || debugMap[ep.id]?.videos.length === 0) && (
                            <li className="text-[#777]">No videos found</li>
                          )}
                        </ul>
                      </div>
                      <div>
                        <div className="text-[#cccccc] mb-1">Part Audios</div>
                        <ul className="space-y-1">
                          {(debugMap[ep.id]?.audios || []).map((u, i) => (
                            <li key={`a-${i}`}>
                              <a className="text-[#00c8c8] hover:underline break-all" href={u} target="_blank" rel="noreferrer">{u}</a>
                            </li>
                          ))}
                          {(!debugMap[ep.id]?.audios || debugMap[ep.id]?.audios.length === 0) && (
                            <li className="text-[#777]">No audios found</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
                
                {ep.status === "FAILED" && (
                  <div className="mt-4 text-[#ef4444] bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-lg p-4">
                    <div className="font-medium">Generation failed</div>
                    <div className="text-sm mt-1">This episode encountered an error during processing.</div>
                  </div>
                )}
                
                {ep.status === "PROCESSING" && (
                  <div className="mt-4 text-[#00c8c8] bg-[#00c8c8]/10 border border-[#00c8c8]/20 rounded-lg p-4">
                    <div className="font-medium">Processing...</div>
                    <div className="text-sm mt-1">Your episode is being generated. This may take a few minutes.</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md bg-[#1f1f1f] border border-[#333] rounded-lg p-6">
            <h3 className="text-xl font-semibold text-white mb-2">Delete episode?</h3>
            <p className="text-[#cccccc] mb-6">“{deleteModal.title}” will be permanently deleted.</p>
            <div className="flex justify-end gap-3">
              <button
                className="btn-secondary"
                onClick={() => setDeleteModal({ open: false, loading: false })}
                disabled={deleteModal.loading}
              >
                Cancel
              </button>
              <button
                className="btn-primary bg-[#ef4444] hover:bg-[#dc2626]"
                onClick={confirmDelete}
                disabled={deleteModal.loading}
              >
                {deleteModal.loading ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

