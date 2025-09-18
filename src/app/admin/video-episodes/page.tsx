"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface VideoEpisode {
  id: string;
  title: string | null;
  status: string;
  videoUrl: string | null;
  audioUrl: string | null;
  coverUrl: string | null;
  durationSec: number | null;
  targetMinutes: number | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    plan: string;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface StatusStats {
  [key: string]: number;
}

export default function AdminVideoEpisodes() {
  const { data: session, status } = useSession();
  const [episodes, setEpisodes] = useState<VideoEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [statusStats, setStatusStats] = useState<StatusStats>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchEpisodes = async (page: number = 1, status: string = "all", search: string = "") => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        ...(status !== "all" && { status }),
        ...(search && { search }),
      });

      const res = await fetch(`/api/admin/video-episodes?${params}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setEpisodes(data.episodes || []);
        setPagination(data.pagination || pagination);
        setStatusStats(data.statusStats || {});
      }
    } catch (error) {
      console.error("Error fetching video episodes:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status !== "authenticated") return;
    fetchEpisodes(currentPage, statusFilter, searchQuery);
  }, [status, currentPage, statusFilter, searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchEpisodes(1, statusFilter, searchQuery);
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "Unknown";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PUBLISHED":
        return "text-green-400 bg-green-400/10";
      case "FAILED":
        return "text-red-400 bg-red-400/10";
      case "VIDEO_RENDER":
        return "text-blue-400 bg-blue-400/10";
      case "SYNTHESIZING":
        return "text-yellow-400 bg-yellow-400/10";
      default:
        return "text-gray-400 bg-gray-400/10";
    }
  };

  if (status === "loading" || loading) {
    return <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center text-[#cccccc]">Loading...</div>;
  }

  if (!session?.user?.isAdmin) {
    return <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center text-[#cccccc]">Forbidden</div>;
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold gradient-text">Video Episodes</h1>
          <Link className="btn-secondary" href="/admin">
            Back to Dashboard
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          {Object.entries(statusStats).map(([status, count]) => (
            <div key={status} className="card">
              <div className="text-[#cccccc] text-sm capitalize">{status.replace("_", " ")}</div>
              <div className="text-2xl text-white font-bold">{count}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="card mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1">
              <input
                type="text"
                placeholder="Search by title, user name, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field flex-1"
              />
              <button type="submit" className="btn-primary">
                Search
              </button>
            </form>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="select-field"
            >
              <option value="all">All Statuses</option>
              {Object.keys(statusStats).map((status) => (
                <option key={status} value={status}>
                  {status.replace("_", " ")} ({statusStats[status]})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Episodes Table */}
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#333333]">
                  <th className="text-left py-3 px-4 text-[#cccccc]">Episode</th>
                  <th className="text-left py-3 px-4 text-[#cccccc]">User</th>
                  <th className="text-left py-3 px-4 text-[#cccccc]">Status</th>
                  <th className="text-left py-3 px-4 text-[#cccccc]">Duration</th>
                  <th className="text-left py-3 px-4 text-[#cccccc]">Created</th>
                  <th className="text-left py-3 px-4 text-[#cccccc]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {episodes.map((episode) => (
                  <tr key={episode.id} className="border-b border-[#222222] hover:bg-[#222222]/50">
                    <td className="py-4 px-4">
                      <div>
                        <div className="text-white font-medium">
                          {episode.title || "Untitled Episode"}
                        </div>
                        <div className="text-[#999999] text-sm">
                          Target: {episode.targetMinutes || 1} min
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div>
                        <div className="text-white">
                          {episode.user.name || episode.user.email || "Unknown User"}
                        </div>
                        <div className="text-[#999999] text-sm">
                          {episode.user.plan} • {episode.user.email}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(episode.status)}`}>
                        {episode.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-[#cccccc]">
                      {formatDuration(episode.durationSec)}
                    </td>
                    <td className="py-4 px-4 text-[#cccccc] text-sm">
                      {formatDate(episode.createdAt)}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex gap-2">
                        {episode.videoUrl && (
                          <a
                            href={episode.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary text-xs"
                          >
                            View Video
                          </a>
                        )}
                        {episode.audioUrl && (
                          <a
                            href={episode.audioUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary text-xs"
                          >
                            View Audio
                          </a>
                        )}
                        <Link
                          href={`/share/${episode.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary text-xs"
                        >
                          View Episode
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-[#333333]">
              <div className="text-[#cccccc] text-sm">
                Showing {((currentPage - 1) * pagination.limit) + 1} to {Math.min(currentPage * pagination.limit, pagination.total)} of {pagination.total} episodes
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-3 py-2 text-[#cccccc]">
                  Page {currentPage} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === pagination.totalPages}
                  className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
