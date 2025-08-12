"use client";
import { useEffect, useState } from "react";

interface Plan {
  plan: string;
  priceCents: number;
  monthlyLimit: number;
  yearlyPriceCents?: number;
  yearlyLimit?: number;
  features?: string | null;
}

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPlans() {
      try {
        const response = await fetch('/api/plans');
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch plans');
        }
        
        setPlans(data.plans || []);
      } catch (err: any) {
        setError(err.message);
        // Fallback to default plans if API fails
        setPlans([
          { plan: "FREE", priceCents: 0, monthlyLimit: 3, yearlyPriceCents: 0, yearlyLimit: 36 },
          { plan: "BASIC", priceCents: 1900, monthlyLimit: 15, yearlyPriceCents: 19000, yearlyLimit: 180 },
          { plan: "PREMIUM", priceCents: 3000, monthlyLimit: 60, yearlyPriceCents: 30000, yearlyLimit: 720 },
        ]);
      } finally {
        setLoading(false);
      }
    }

    fetchPlans();
  }, []);

  const formatPrice = (priceCents: number) => {
    if (priceCents === 0) return "$0";
    return `$${(priceCents / 100).toFixed(0)}`;
  };

  const getPlanName = (planKey: string) => {
    switch (planKey) {
      case "FREE": return "Free";
      case "BASIC": return "Basic";
      case "PREMIUM": return "Premium";
      default: return planKey;
    }
  };
  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00c8c8] mx-auto mb-4"></div>
          <p className="text-[#cccccc]">Loading pricing plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl lg:text-5xl font-bold gradient-text mb-3">Pricing</h1>
          <p className="text-[#cccccc] mb-6">Choose the plan that fits your podcasting needs</p>
          <div className="inline-flex items-center gap-2 bg-[#0f0f0f] border border-[#333] rounded-lg p-1">
            <button onClick={() => setBilling("monthly")} className={`px-4 py-2 rounded-md ${billing === "monthly" ? "bg-[#1a1a1a] text-white" : "text-[#cccccc]"}`}>Monthly</button>
            <button onClick={() => setBilling("yearly")} className={`px-4 py-2 rounded-md ${billing === "yearly" ? "bg-[#1a1a1a] text-white" : "text-[#cccccc]"}`}>Yearly</button>
          </div>
        </div>
        
        {error && (
          <div className="text-center mb-8">
            <div className="text-[#ef4444] bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-lg p-4 inline-block">
              <p className="text-sm">Note: Using default pricing. {error}</p>
            </div>
          </div>
        )}
        
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const price = billing === "monthly" ? (plan.priceCents || 0) : (plan.yearlyPriceCents || 0);
            const limit = billing === "monthly" ? (plan.monthlyLimit || 0) : (plan.yearlyLimit || plan.monthlyLimit * 12 || 0);
            return (
            <div key={plan.plan} className="card flex flex-col items-center text-center">
              <div className="text-white text-2xl font-semibold mb-2">{getPlanName(plan.plan)}</div>
              <div className="text-4xl font-extrabold text-white mb-1">
                {formatPrice(price)}
                <span className="text-base font-medium text-[#cccccc]">/{billing === "monthly" ? "mo" : "yr"}</span>
              </div>
              <div className="text-[#cccccc] mb-6">
                {billing === "monthly" ? (
                  <>Up to {limit} podcasts / month</>
                ) : (
                  <>Up to {limit} podcasts / year</>
                )}
              </div>
              <form action="/api/user" method="post" className="w-full">
                <input type="hidden" name="plan" value={plan.plan} />
                <CheckoutButton plan={plan} billing={billing} />
              </form>
            </div>
          );})}
        </div>
      </div>
    </div>
  );
}

function CheckoutButton({ plan, billing }: { plan: Plan; billing: "monthly" | "yearly" }) {
  const [loading, setLoading] = useState(false);
  const handleCheckout = async () => {
    setLoading(true);
    try {
      const priceId = billing === "monthly" ? (plan as any).stripePriceMonthlyId : (plan as any).stripePriceYearlyId;
      if (!priceId) {
        alert("This plan is not available for checkout yet. Please try again later.");
        return;
      }
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');
      window.location.href = data.url;
    } catch (e: any) {
      alert(e.message || 'Checkout error');
    } finally {
      setLoading(false);
    }
  };
  return (
    <button type="button" onClick={handleCheckout} disabled={loading} className="btn-primary w-full py-3 disabled:opacity-50">
      {loading ? 'Redirecting…' : `Choose ${plan.plan}`}
    </button>
  );
}


