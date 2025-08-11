import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

async function getPrisma() {
  const { prisma } = await import("@/lib/prisma");
  return prisma;
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  const prisma = await getPrisma();
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  if (!me?.isAdmin) throw new Error("Forbidden");
}

export async function GET() {
  // Prevent execution during build time
  if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
    return NextResponse.json({ error: "Not available during build" }, { status: 503 });
  }
  
  try {
    await requireAdmin();
    const prisma = await getPrisma();
    const users = await prisma.user.findMany({ select: { id: true, email: true, name: true, plan: true, isAdmin: true, createdAt: true } });
    return NextResponse.json({ users });
  } catch (e: any) {
    console.error("Admin users GET error:", e);
    const status = e.message === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: e.message }, { status });
  }
}

export async function POST(req: NextRequest) {
  // Prevent execution during build time
  if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
    return NextResponse.json({ error: "Not available during build" }, { status: 503 });
  }
  
  try {
    await requireAdmin();
    const prisma = await getPrisma();
    const body = await req.json();
    const { userId, plan, isAdmin } = body || {};
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
    const data: any = {};
    if (plan && ["FREE", "BASIC", "PREMIUM"].includes(plan)) data.plan = plan;
    if (typeof isAdmin === "boolean") data.isAdmin = isAdmin;
    await prisma.user.update({ where: { id: userId }, data });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Admin users POST error:", e);
    const status = e.message === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: e.message }, { status });
  }
}


