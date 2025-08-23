"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

type UserResp = {
  user: { id: string; email: string | null; name: string | null; plan: "FREE" | "BASIC" | "PREMIUM" };
  usage: { limit: number; used: number; remaining: number };
};

export default function ProfilePage() {
  const { data: session, status: sessionStatus } = useSession();
  const [data, setData] = useState<UserResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<string>("");
  const [pwdErr, setPwdErr] = useState<string>("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (sessionStatus === "authenticated" && session) {
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
    } else if (sessionStatus === "unauthenticated") {
      setLoading(false);
    }
  }, [sessionStatus, session]);

  // Check if user is authenticated
  if (sessionStatus === "loading") {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00c8c8] mx-auto mb-4"></div>
          <p className="text-[#cccccc]">Loading...</p>
        </div>
      </div>
    );
  }

  if (sessionStatus === "unauthenticated" || !session) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <h1 className="text-3xl font-bold text-white mb-4">Authentication Required</h1>
          <p className="text-[#cccccc] mb-8">
            You need to be logged in to view your profile. Please sign in or create an account to continue.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login" className="btn-primary px-6 py-3">
              Sign In
            </Link>
            <Link href="/register" className="btn-secondary px-6 py-3">
              Create Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00c8c8] mx-auto mb-4"></div>
          <p className="text-[#cccccc]">Loading profile...</p>
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

        {/* Password Reset */}
        <div className="card mt-8">
          <div className="text-white text-xl font-semibold mb-2">Change Password</div>
          <div className="text-[#999999] text-sm mb-4">Set a new password for your account.</div>
          {(pwdMsg || pwdErr) && (
            <div className={`mb-3 rounded-lg p-3 ${pwdErr ? "bg-[#ef4444]/10 border border-[#ef4444]/20 text-[#ef4444]" : "bg-[#66cc66]/10 border border-[#66cc66]/20 text-[#66cc66]"}`}>
              {pwdErr || pwdMsg}
            </div>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setPwdLoading(true); setPwdErr(""); setPwdMsg("");
              try {
                const res = await fetch("/api/user/password", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ currentPassword, newPassword })
                });
                const d = await res.json();
                if (!res.ok) throw new Error(d.error || "Failed");
                setPwdMsg("Password updated successfully");
                setCurrentPassword(""); setNewPassword("");
              } catch (err: any) {
                setPwdErr(err.message || "Failed to update password");
              } finally {
                setPwdLoading(false);
                setTimeout(() => { setPwdMsg(""); setPwdErr(""); }, 5000);
              }
            }}
            className="grid gap-4"
          >
            <div>
              <label className="block text-sm font-medium text-[#cccccc] mb-2">Current Password</label>
              <input
                type="password"
                className="input-field w-full"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#cccccc] mb-2">New Password</label>
              <input
                type="password"
                className="input-field w-full"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
                required
              />
            </div>
            <div>
              <button className="btn-primary" disabled={pwdLoading}>
                {pwdLoading ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}


