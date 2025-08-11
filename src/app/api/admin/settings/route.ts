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
    const settings = await prisma.siteSettings.upsert({
      where: { id: "main" },
      update: {},
      create: { id: "main" },
    });
    return NextResponse.json({ settings });
  } catch (e: any) {
    const status = e.message === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: e.message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const { siteName, maintenanceMode, settingsJson } = body || {};
    const updated = await prisma.siteSettings.upsert({
      where: { id: "main" },
      update: { siteName: siteName ?? undefined, maintenanceMode: Boolean(maintenanceMode), settingsJson: settingsJson ?? undefined },
      create: { id: "main", siteName: siteName ?? undefined, maintenanceMode: Boolean(maintenanceMode), settingsJson: settingsJson ?? undefined },
    });
    return NextResponse.json({ settings: updated });
  } catch (e: any) {
    const status = e.message === "Forbidden" ? 403 : 401;
    return NextResponse.json({ error: e.message }, { status });
  }
}


