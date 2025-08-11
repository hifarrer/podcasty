import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

async function getPrisma() {
  const { prisma } = await import("@/lib/prisma");
  return prisma;
}

export async function GET() {
  // Prevent execution during build time
  if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
    return NextResponse.json({ error: "Not available during build" }, { status: 503 });
  }
  
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prisma = await getPrisma();
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  if (!me?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Episodes per month (last 12)
  const now = new Date();
  const months: { label: string; count: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    const count = await prisma.episode.count({ where: { createdAt: { gte: d, lt: next } } });
    months.push({ label: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`, count });
  }

  // Category chart placeholder: derive from episode.title keywords (simple heuristic)
  const recent = await prisma.episode.findMany({ select: { title: true }, orderBy: { createdAt: "desc" }, take: 200 });
  const buckets: Record<string, number> = {};
  const keywords: Record<string, string[]> = {
    Technology: ["ai", "tech", "software", "programming", "startup"],
    Business: ["market", "business", "finance", "sales", "growth"],
    Science: ["science", "research", "study", "biology", "physics"],
    Health: ["health", "medicine", "fitness", "wellness"],
    Entertainment: ["movie", "music", "celebrity", "tv"],
    Other: [],
  };
  for (const r of recent) {
    const t = (r.title || "").toLowerCase();
    let cat: string | null = null;
    for (const [k, words] of Object.entries(keywords)) {
      if (k === "Other") continue;
      if (words.some((w) => t.includes(w))) { cat = k; break; }
    }
    buckets[cat || "Other"] = (buckets[cat || "Other"] || 0) + 1;
  }

  const users = await prisma.user.count();
  const episodes = await prisma.episode.count();

  return NextResponse.json({ months, categories: buckets, totals: { users, episodes } });
}


