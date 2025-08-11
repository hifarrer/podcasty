import { NextRequest } from "next/server";
import RSS from "rss";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  // TODO: replace with real auth: we accept token via query for private feed
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return new Response("Missing token", { status: 400 });

  const feed = await prisma.feed.findFirst({ where: { privateToken: token }, include: { user: true } });
  if (!feed) return new Response("Feed not found", { status: 404 });

  const episodes = await prisma.episode.findMany({
    where: { userId: feed.userId, status: "PUBLISHED" as any },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const rss = new RSS({
    title: feed.title,
    description: feed.description,
    feed_url: req.url,
    site_url: req.url,
    image_url: feed.imageUrl || undefined,
    language: "en",
    custom_namespaces: { itunes: "http://www.itunes.com/dtds/podcast-1.0.dtd" },
    custom_elements: [{ "itunes:author": feed.user.name || "Podcasty" }, { "itunes:explicit": "no" }],
  });

  for (const ep of episodes) {
    if (!ep.audioUrl) continue;
    rss.item({
      title: ep.title || "Untitled Episode",
      description: ep.showNotesMd || "",
      url: ep.audioUrl,
      guid: ep.id,
      date: ep.createdAt,
      enclosure: { url: ep.audioUrl, type: "audio/mpeg" },
      custom_elements: ep.durationSec
        ? [{ "itunes:duration": ep.durationSec.toString() }]
        : undefined,
    });
  }

  const xml = rss.xml({ indent: true });
  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}




