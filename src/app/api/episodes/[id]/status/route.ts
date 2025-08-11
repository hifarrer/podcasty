import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getCurrentUserId();
    const episode = await prisma.episode.findFirst({ where: { id: params.id, userId } });
    if (!episode) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(
      { status: episode.status, episode },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("[api/episodes/status] GET error", error);
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
}


