"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

type UserResp = {
  user: { id: string; email: string | null; name: string | null; plan: "FREE" | "BASIC" | "PREMIUM" };
  usage: { limit: number; used: number; remaining: number };
};

export default function ProfilePage() {
  const { status } = useSession();
  const [data, setData] = useState<UserResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") return;
    (async () => {
      try {
        const res = await fetch("/api/user", { credentials: "include", cache: "no-store" });
        if (res.ok) {
          const d = await res.json();
          setData(d);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [status]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center"><div className="text-[#cccccc]">Loading...</div></div>
    );
  }
  if (status !== "authenticated") {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold gradient-text mb-3">Sign In Required</h1>
          <div className="flex gap-3 justify-center"><Link className="btn-primary" href="/login">Sign In</Link><Link className="btn-secondary" href="/register">Create Account</Link></div>
        </div>
      </div>
    );
  }

  const planLabels: Record<string, string> = { FREE: "Free", BASIC: "Basic", PREMIUM: "Premium" };

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold gradient-text mb-8">Profile</h1>
        <div className="card">
          <div className="text-white text-xl font-semibold mb-2">Current Plan</div>
          <div className="text-[#cccccc] mb-4">{data ? planLabels[data.user.plan] : "-"}</div>

          {data && (
            <div className="space-y-2">
              <div className="flex justify-between text-[#cccccc]"><span>Monthly limit</span><span>{data.usage.limit}</span></div>
              <div className="flex justify-between text-[#cccccc]"><span>Used</span><span>{data.usage.used}</span></div>
              <div className="flex justify-between text-[#cccccc]"><span>Remaining</span><span>{data.usage.remaining}</span></div>
              <div className="w-full bg-[#2a2a2a] rounded-full h-2 overflow-hidden mt-2">
                <div className="h-full bg-gradient-to-r from-[#00c8c8] to-[#007bff]" style={{ width: `${(data.usage.used / Math.max(1, data.usage.limit)) * 100}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className="mt-8">
          <Link href="/pricing" className="btn-secondary">Change Plan</Link>
        </div>
      </div>
    </div>
  );
}


