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
    const settings = await prisma.siteSettings.upsert({
      where: { id: "main" },
      update: {},
      create: { id: "main" },
    });
    return NextResponse.json({ settings });
  } catch (e: any) {
    console.error("Admin settings GET error:", e);
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
    const { siteName, maintenanceMode, settingsJson } = body || {};
    const updated = await prisma.siteSettings.upsert({
      where: { id: "main" },
      update: { siteName: siteName ?? undefined, maintenanceMode: Boolean(maintenanceMode), settingsJson: settingsJson ?? undefined },
      create: { id: "main", siteName: siteName ?? undefined, maintenanceMode: Boolean(maintenanceMode), settingsJson: settingsJson ?? undefined },
    });
    return NextResponse.json({ settings: updated });
  } catch (e: any) {
    console.error("Admin settings POST error:", e);
    const status = e.message === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: e.message }, { status });
  }
}


