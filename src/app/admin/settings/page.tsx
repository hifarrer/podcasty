"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function AdminSettings() {
  const { data: session, status } = useSession();
  const [settings, setSettings] = useState<any>({ siteName: "", maintenanceMode: false, settingsJson: undefined });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string>("");
  const [savedErr, setSavedErr] = useState<string>("");

  useEffect(() => {
    if (status !== "authenticated") return;
    (async () => {
      try {
        const res = await fetch("/api/admin/settings", { credentials: "include" });
        if (res.ok) setSettings((await res.json()).settings);
      } finally { setLoading(false); }
    })();
  }, [status]);

  const save = async () => {
    try {
      setSaving(true);
      setSavedMsg("");
      setSavedErr("");
      const res = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(settings) });
      if (res.ok) {
        setSavedMsg("Settings saved successfully");
      } else {
        const data = await res.json().catch(() => ({} as any));
        setSavedErr(data?.error || "Failed to save settings");
      }
    } catch (e: any) {
      setSavedErr(e?.message || "Network error while saving");
    } finally {
      setSaving(false);
      setTimeout(() => { setSavedMsg(""); setSavedErr(""); }, 8000);
    }
  };

  if (status === "loading" || loading) return <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center text-[#cccccc]">Loading...</div>;
  if (!session?.user?.isAdmin) return <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center text-[#cccccc]">Forbidden</div>;

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        <h1 className="text-3xl font-bold gradient-text">Site Settings</h1>
        {(savedMsg || savedErr) && (
          <div className={`rounded-lg p-3 ${savedErr ? "bg-[#ef4444]/10 border border-[#ef4444]/20 text-[#ef4444]" : "bg-[#66cc66]/10 border border-[#66cc66]/20 text-[#66cc66]"}`}>
            {savedErr || savedMsg}
          </div>
        )}
        <div className="card space-y-4">
          <div>
            <label className="block text-sm text-[#cccccc] mb-1">Site Name</label>
            <input className="input-field w-full" value={settings?.siteName || ""} onChange={(e) => setSettings({ ...settings, siteName: e.target.value })} />
          </div>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={!!settings?.maintenanceMode} onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })} />
            <span className="text-[#cccccc]">Maintenance Mode</span>
          </label>
          <div className="flex items-center gap-3">
            <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</button>
            {savedMsg && <span className="text-[#66cc66] text-sm">{savedMsg}</span>}
            {savedErr && <span className="text-[#ef4444] text-sm">{savedErr}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}


