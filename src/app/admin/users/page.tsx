"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function AdminUsers() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string>("");
  const [msg, setMsg] = useState<string>("");
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    if (status !== "authenticated") return;
    (async () => {
      try {
        const res = await fetch("/api/admin/users", { credentials: "include" });
        if (res.ok) {
          const d = await res.json();
          setUsers(d.users || []);
        }
      } finally { setLoading(false); }
    })();
  }, [status]);

  const updateUser = async (id: string, patch: any) => {
    try {
      setSavingId(id);
      setMsg(""); setErr("");
      const res = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ userId: id, ...patch }) });
      if (res.ok) {
        setMsg("Changes saved");
        // refresh list
        const r = await fetch("/api/admin/users", { credentials: "include" });
        if (r.ok) {
          const d = await r.json();
          setUsers(d.users || []);
        }
      } else {
        const d = await res.json().catch(() => ({} as any));
        setErr(d?.error || "Failed to save changes");
      }
    } catch (e: any) {
      setErr(e?.message || "Network error");
    } finally {
      setSavingId("");
      setTimeout(() => { setMsg(""); setErr(""); }, 5000);
    }
  };

  const adjustUsage = async (id: string, delta: number, reason?: string) => {
    if (!delta) return;
    await updateUser(id, { adjustUsageBy: delta, reason });
  };

  if (status === "loading" || loading) return <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center text-[#cccccc]">Loading...</div>;
  if (!session?.user?.isAdmin) return <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center text-[#cccccc]">Forbidden</div>;

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold gradient-text mb-6">Manage Users</h1>
        {(msg || err) && (
          <div className={`mb-4 rounded-lg p-3 ${err ? "bg-[#ef4444]/10 border border-[#ef4444]/20 text-[#ef4444]" : "bg-[#66cc66]/10 border border-[#66cc66]/20 text-[#66cc66]"}`}>
            {err || msg}
          </div>
        )}
        <div className="space-y-3">
          {users.map((u) => (
            <div key={u.id} className="card flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div className="text-white font-semibold">{u.name || u.email || u.id}</div>
                <div className="text-[#999999] text-sm">Plan: {u.plan} • {u.isAdmin ? "Admin" : "User"}</div>
                {u.usage && (
                  <div className="text-xs text-[#cccccc] mt-1">This month: used {u.usage.effective} (base {u.usage.baseUsed ?? u.usage.used}, adj {u.usage.delta ?? 0})</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <select defaultValue={u.plan} disabled={savingId === u.id} onChange={(e) => updateUser(u.id, { plan: e.target.value })} className="select-field">
                  <option value="FREE">Free</option>
                  <option value="BASIC">Basic</option>
                  <option value="PREMIUM">Premium</option>
                </select>
                <button className="btn-secondary" disabled={savingId === u.id} onClick={() => updateUser(u.id, { isAdmin: !u.isAdmin })}>{savingId === u.id ? "Saving..." : (u.isAdmin ? "Revoke Admin" : "Make Admin")}</button>
                <div className="flex items-center gap-1">
                  <button className="btn-secondary" disabled={savingId === u.id} onClick={() => adjustUsage(u.id, -1, "Admin subtract 1")}>-1</button>
                  <button className="btn-secondary" disabled={savingId === u.id} onClick={() => adjustUsage(u.id, 1, "Admin add 1")}>+1</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


