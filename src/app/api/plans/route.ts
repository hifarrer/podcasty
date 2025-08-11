import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

async function getPrisma() {
  const { prisma } = await import("@/lib/prisma");
  return prisma;
}

export async function GET() {
  try {
    const prisma = await getPrisma();
    const plans = await prisma.planConfig.findMany({
      orderBy: { priceCents: 'asc' }
    });
    return NextResponse.json({ plans });
  } catch (e: any) {
    console.error("Plans GET error:", e);
    return NextResponse.json({ error: "Failed to fetch plans" }, { status: 500 });
  }
}
