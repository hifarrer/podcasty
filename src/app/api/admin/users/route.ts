import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  if (!me?.isAdmin) throw new Error("Forbidden");
}

export async function GET() {
  try {
    await requireAdmin();
    const users = await prisma.user.findMany({ select: { id: true, email: true, name: true, plan: true, isAdmin: true, createdAt: true } });
    return NextResponse.json({ users });
  } catch (e: any) {
    const status = e.message === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: e.message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const { userId, plan, isAdmin } = body || {};
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
    const data: any = {};
    if (plan && ["FREE", "BASIC", "PREMIUM"].includes(plan)) data.plan = plan;
    if (typeof isAdmin === "boolean") data.isAdmin = isAdmin;
    await prisma.user.update({ where: { id: userId }, data });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = e.message === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: e.message }, { status });
  }
}


