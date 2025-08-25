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
        setEpisodes(data.episodes || []);
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

        {episodes.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-24 h-24 bg-gradient-to-r from-[#00c8c8] to-[#007bff] rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-white mb-4">No episodes yet</h2>
            <p className="text-[#cccccc] mb-8 max-w-md mx-auto">
              Create your first podcast episode to get started. Transform any content into professional audio with AI-powered voice synthesis.
            </p>
            <a href="/create" className="btn-primary text-lg px-8 py-4">
              Create Your First Episode
            </a>
          </div>
        ) : (
          <div className="grid gap-6">
            {episodes.map((ep) => (
              <div key={ep.id} className="card group hover:border-[#00c8c8] transition-all duration-300">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-white group-hover:text-[#00c8c8] transition-colors">
                        {ep.title || "Untitled Episode"}
                      </h3>
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(ep.status)}`}>
                        {getStatusIcon(ep.status)}
                        {ep.status}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6 text-sm text-[#999999]">
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
                        {ep.targetMinutes || 2} min target
                      </div>
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                        {ep.mode || 'SUMMARY'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
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
                      href={`/episodes/${ep.id}`} 
                      className="btn-ghost p-2 hover:bg-[#222222] rounded-lg"
                      title="View Details"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
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
    </div>
  );
}


