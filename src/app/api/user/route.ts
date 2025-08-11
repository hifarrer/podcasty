import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/server-auth";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, plan: true } });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // compute usage for current month
    const start = new Date();
    start.setUTCDate(1); start.setUTCHours(0,0,0,0);
    const episodesThisMonth = await prisma.episode.count({ where: { userId, createdAt: { gte: start } } });

    const limits: Record<string, number> = { FREE: 3, BASIC: 15, PREMIUM: 60 };
    const limit = limits[user.plan];
    const remaining = Math.max(0, limit - episodesThisMonth);

    return NextResponse.json({ user, usage: { limit, used: episodesThisMonth, remaining } });
  } catch (e: any) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();
    let plan: "FREE" | "BASIC" | "PREMIUM" | undefined;
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await req.json();
      plan = body?.plan;
    } else if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const p = form.get("plan");
      plan = (typeof p === "string" ? p : undefined) as any;
    }
    if (!plan || !["FREE", "BASIC", "PREMIUM"].includes(plan)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }
    await prisma.user.update({ where: { id: userId }, data: { plan } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
}


