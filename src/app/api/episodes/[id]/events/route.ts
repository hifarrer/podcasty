import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getCurrentUserId();
    
    // Verify the episode belongs to the user
    const episode = await prisma.episode.findFirst({
      where: { id: params.id, userId }
    });
    
    if (!episode) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    
    const events = await prisma.eventLog.findMany({
      where: { episodeId: params.id },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    
    return NextResponse.json({ events });
  } catch (error) {
    console.error("[api/episodes/events] GET error", error);
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
}


