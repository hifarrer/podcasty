import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getCurrentUserId();
    const episode = await prisma.episode.findFirst({ where: { id: params.id, userId } });
    if (!episode) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Remove related records first
    await prisma.eventLog.deleteMany({ where: { episodeId: params.id } });
    await prisma.episode.delete({ where: { id: params.id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/episodes/:id] DELETE error", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}


