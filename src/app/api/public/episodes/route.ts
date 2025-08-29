import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EpisodeStatus } from "@prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10) || 0);
    const limitRaw = Math.max(1, parseInt(searchParams.get("limit") || "9", 10) || 9);
    const limit = Math.min(50, limitRaw);

    const episodes = await prisma.episode.findMany({
      where: { isPublic: true, status: EpisodeStatus.PUBLISHED },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
      select: {
        id: true,
        title: true,
        sourceType: true,
        promptText: true,
        audioUrl: true,
        videoUrl: true,
        coverUrl: true,
        createdAt: true,
      }
    });
    return NextResponse.json({ episodes, hasMore: episodes.length === limit });
  } catch (e) {
    return NextResponse.json({ episodes: [], hasMore: false });
  }
}
