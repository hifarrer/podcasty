"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface PublicEpisode {
  id: string;
  title?: string;
  audioUrl?: string;
  coverUrl?: string;
  createdAt: string;
}

export default function SharePage({ params }: { params: { id: string } }) {
  const [episode, setEpisode] = useState<PublicEpisode | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(`/api/public/episodes/${params.id}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setEpisode(data.episode || null);
        }
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-[#cccccc]">Loading…</div>
      </div>
    );
  }

  if (!episode) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-white mb-2">Episode not found</h1>
          <p className="text-[#cccccc] mb-6">This shared episode is unavailable.</p>
          <Link href="/" className="btn-primary">Go Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="card p-6">
          <h1 className="text-3xl font-bold text-white mb-4">{episode.title || "Shared Episode"}</h1>
          {episode.coverUrl && (
            <img src={episode.coverUrl} alt="Cover" className="w-full rounded-lg mb-4" />
          )}
          {episode.audioUrl ? (
            <audio controls className="w-full" preload="metadata">
              <source src={episode.audioUrl} type="audio/mpeg" />
            </audio>
          ) : (
            <div className="text-[#cccccc]">No audio available.</div>
          )}
          <div className="mt-6 flex items-center justify-between text-sm text-[#999]">
            <div>{new Date(episode.createdAt).toLocaleDateString()}</div>
            <Link href="/" className="btn-secondary">Create your own</Link>
          </div>
        </div>
      </div>
    </div>
  );
}


