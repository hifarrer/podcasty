"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function AdminPlans() {
  const { data: session, status } = useSession();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [err, setErr] = useState<string>("");

  const fetchPlans = async () => {
    const res = await fetch("/api/admin/plans", { credentials: "include" });
    if (res.ok) {
      const d = await res.json();
      setPlans(d.plans || []);
    }
  };

  useEffect(() => {
    if (status !== "authenticated") return;
    (async () => { try { await fetchPlans(); } finally { setLoading(false); } })();
  }, [status]);

  const savePlan = async (p: any) => {
    try {
      setSaving(true); setMsg(""); setErr("");
      const res = await fetch("/api/admin/plans", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(p) });
      if (res.ok) {
        setMsg("Plan saved");
        await fetchPlans();
      } else {
        const d = await res.json().catch(() => ({} as any));
        setErr(d?.error || "Failed to save plan");
      }
    } catch (e: any) {
      setErr(e?.message || "Network error");
    } finally {
      setSaving(false);
      setTimeout(() => { setMsg(""); setErr(""); }, 5000);
    }
  };

  if (status === "loading" || loading) return <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center text-[#cccccc]">Loading...</div>;
  if (!session?.user?.isAdmin) return <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center text-[#cccccc]">Forbidden</div>;

  const all = ["FREE", "BASIC", "PREMIUM"];
  const merged = all.map((k) => plans.find((p) => p.plan === k) || { plan: k, priceCents: 0, monthlyLimit: 0, yearlyPriceCents: 0, yearlyLimit: 0, stripePriceMonthlyId: "", stripePriceYearlyId: "", features: [] });

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-6">
        <h1 className="text-3xl font-bold gradient-text">Manage Plans</h1>
        {(msg || err) && (
          <div className={`rounded-lg p-3 ${err ? "bg-[#ef4444]/10 border border-[#ef4444]/20 text-[#ef4444]" : "bg-[#66cc66]/10 border border-[#66cc66]/20 text-[#66cc66]"}`}>
            {err || msg}
          </div>
        )}
        {merged.map((p) => (
          <div key={p.plan} className="card space-y-3">
            <div className="text-white text-xl font-semibold">{p.plan}</div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-[#cccccc] mb-1">Price (USD/month)</label>
                <input className="input-field w-full" type="number" disabled={saving} defaultValue={(p.priceCents || 0) / 100} onBlur={(e) => savePlan({ plan: p.plan, priceCents: Math.round(Number(e.target.value) * 100), monthlyLimit: p.monthlyLimit, yearlyPriceCents: p.yearlyPriceCents, yearlyLimit: p.yearlyLimit, stripePriceMonthlyId: p.stripePriceMonthlyId, stripePriceYearlyId: p.stripePriceYearlyId, features: p.features })} />
              </div>
              <div>
                <label className="block text-sm text-[#cccccc] mb-1">Monthly limit</label>
                <input className="input-field w-full" type="number" disabled={saving} defaultValue={p.monthlyLimit || 0} onBlur={(e) => savePlan({ plan: p.plan, priceCents: p.priceCents, monthlyLimit: Number(e.target.value), yearlyPriceCents: p.yearlyPriceCents, yearlyLimit: p.yearlyLimit, stripePriceMonthlyId: p.stripePriceMonthlyId, stripePriceYearlyId: p.stripePriceYearlyId, features: p.features })} />
              </div>
              <div>
                <label className="block text-sm text-[#cccccc] mb-1">Yearly price (USD/year)</label>
                <input className="input-field w-full" type="number" disabled={saving} defaultValue={(p.yearlyPriceCents || 0) / 100} onBlur={(e) => savePlan({ plan: p.plan, priceCents: p.priceCents, monthlyLimit: p.monthlyLimit, yearlyPriceCents: Math.round(Number(e.target.value) * 100), yearlyLimit: p.yearlyLimit, stripePriceMonthlyId: p.stripePriceMonthlyId, stripePriceYearlyId: p.stripePriceYearlyId, features: p.features })} />
              </div>
              <div>
                <label className="block text-sm text-[#cccccc] mb-1">Yearly limit</label>
                <input className="input-field w-full" type="number" disabled={saving} defaultValue={p.yearlyLimit || 0} onBlur={(e) => savePlan({ plan: p.plan, priceCents: p.priceCents, monthlyLimit: p.monthlyLimit, yearlyPriceCents: p.yearlyPriceCents, yearlyLimit: Number(e.target.value), stripePriceMonthlyId: p.stripePriceMonthlyId, stripePriceYearlyId: p.stripePriceYearlyId, features: p.features })} />
              </div>
              <div>
                <label className="block text-sm text-[#cccccc] mb-1">Stripe Price (Monthly)</label>
                <input className="input-field w-full" type="text" disabled={saving} defaultValue={p.stripePriceMonthlyId || ""} onBlur={(e) => savePlan({ plan: p.plan, priceCents: p.priceCents, monthlyLimit: p.monthlyLimit, yearlyPriceCents: p.yearlyPriceCents, yearlyLimit: p.yearlyLimit, stripePriceMonthlyId: e.target.value, stripePriceYearlyId: p.stripePriceYearlyId, features: p.features })} />
              </div>
              <div>
                <label className="block text-sm text-[#cccccc] mb-1">Stripe Price (Yearly)</label>
                <input className="input-field w-full" type="text" disabled={saving} defaultValue={p.stripePriceYearlyId || ""} onBlur={(e) => savePlan({ plan: p.plan, priceCents: p.priceCents, monthlyLimit: p.monthlyLimit, yearlyPriceCents: p.yearlyPriceCents, yearlyLimit: p.yearlyLimit, stripePriceMonthlyId: p.stripePriceMonthlyId, stripePriceYearlyId: e.target.value, features: p.features })} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


