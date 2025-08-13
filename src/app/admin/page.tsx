import Link from "next/link";

export default function AdminHome() {
  return (
    <div className="min-h-screen bg-[#1a1a1a] text-[#cccccc]">
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        <h1 className="text-3xl font-bold gradient-text">Admin</h1>
        <div className="card p-6 space-y-4">
          <Link href="/admin/settings" className="btn-secondary inline-block">Site Settings</Link>
          <Link href="/admin/users" className="btn-secondary inline-block">Users</Link>
          <Link href="/admin/plans" className="btn-secondary inline-block">Plans</Link>
        </div>
      </div>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

export default function AdminHome() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") return;
    (async () => {
      try {
        const res = await fetch("/api/admin/stats", { credentials: "include" });
        if (res.ok) setStats(await res.json());
      } finally { setLoading(false); }
    })();
  }, [status]);

  if (status === "loading" || loading) {
    return <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center text-[#cccccc]">Loading...</div>;
  }
  if (!session?.user?.isAdmin) {
    return <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center text-[#cccccc]">Forbidden</div>;
  }

  const months: { label: string; count: number }[] = stats?.months ?? [];
  const categories = stats?.categories ?? {};
  const totals = stats?.totals ?? {};

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      <div className="max-w-6xl mx-auto px-6 py-12 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold gradient-text">Admin Dashboard</h1>
          <div className="flex gap-3">
            <Link className="btn-secondary" href="/admin/users">Users</Link>
            <Link className="btn-secondary" href="/admin/plans">Plans</Link>
            <Link className="btn-secondary" href="/admin/settings">Settings</Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="card"><div className="text-[#cccccc]">Users</div><div className="text-3xl text-white font-bold">{totals.users ?? 0}</div></div>
          <div className="card"><div className="text-[#cccccc]">Episodes</div><div className="text-3xl text-white font-bold">{totals.episodes ?? 0}</div></div>
          <div className="card"><div className="text-[#cccccc]">Categories</div><div className="text-3xl text-white font-bold">{Object.keys(categories).length}</div></div>
        </div>

        <div className="card">
          <div className="text-white text-xl font-semibold mb-4">Monthly Episodes (last 12)</div>
          <div className="grid grid-cols-12 gap-2 items-end">
            {months.map((m) => (
              <div key={m.label} className="text-center">
                <div className="bg-gradient-to-r from-[#00c8c8] to-[#007bff] w-full" style={{ height: `${Math.min(200, 10 + m.count * 10)}px` }} />
                <div className="text-[10px] text-[#999999] mt-1">{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="text-white text-xl font-semibold mb-4">Categories</div>
          <div className="grid md:grid-cols-3 gap-3">
            {Object.entries(categories).map(([k, v]: any) => (
              <div key={k} className="flex items-center justify-between text-[#cccccc] p-3 rounded-lg bg-[#222222]">
                <span>{k}</span><span className="text-white font-semibold">{v as any}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


