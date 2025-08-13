import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EpisodeStatus } from "@prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const episodes = await prisma.episode.findMany({
      where: { isPublic: true, status: EpisodeStatus.PUBLISHED },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        title: true,
        sourceType: true,
        promptText: true,
        audioUrl: true,
        createdAt: true,
      }
    });
    return NextResponse.json({ episodes });
  } catch (e) {
    return NextResponse.json({ episodes: [] });
  }
}
