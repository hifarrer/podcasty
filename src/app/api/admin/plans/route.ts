import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  if (!me?.isAdmin) throw new Error("Forbidden");
}

export async function GET() {
  try {
    await requireAdmin();
    const plans = await prisma.planConfig.findMany({});
    return NextResponse.json({ plans });
  } catch (e: any) {
    const status = e.message === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: e.message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const { plan, priceCents, monthlyLimit, features } = body || {};
    if (!plan || !["FREE", "BASIC", "PREMIUM"].includes(plan)) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    const updated = await prisma.planConfig.upsert({
      where: { plan },
      update: { priceCents: Number(priceCents) || 0, monthlyLimit: Number(monthlyLimit) || 0, features: features ?? undefined },
      create: { plan, priceCents: Number(priceCents) || 0, monthlyLimit: Number(monthlyLimit) || 0, features: features ?? undefined },
    });
    return NextResponse.json({ plan: updated });
  } catch (e: any) {
    const status = e.message === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: e.message }, { status });
  }
}


