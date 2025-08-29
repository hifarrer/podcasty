import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EpisodeStatus } from "@prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const episode = await prisma.episode.findFirst({
      where: { id: params.id, isPublic: true, status: EpisodeStatus.PUBLISHED },
      select: {
        id: true,
        title: true,
        audioUrl: true,
        videoUrl: true,
        coverUrl: true,
        createdAt: true,
      },
    });

    if (!episode) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ episode });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}


