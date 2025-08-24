import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-auth";
import { uploadBuffer } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const userId = await requireAuth();
    const media = await prisma.media.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ media });
  } catch (e) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await requireAuth();
    const { url } = await req.json();
    if (!url || typeof url !== "string") return NextResponse.json({ error: "url required" }, { status: 400 });
    const res = await fetch(url);
    if (!res.ok) return NextResponse.json({ error: `Fetch failed: ${res.status}` }, { status: 400 });
    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const buf = Buffer.from(await res.arrayBuffer());
    const isImage = contentType.startsWith("image/");
    const isVideo = contentType.startsWith("video/");
    if (!isImage && !isVideo) return NextResponse.json({ error: "Only image/video supported" }, { status: 400 });
    const ext = isImage
      ? (contentType.includes("png") ? ".png" : contentType.includes("webp") ? ".webp" : contentType.includes("gif") ? ".gif" : ".jpg")
      : (contentType.includes("webm") ? ".webm" : ".mp4");
    const prefix = "media";
    const uploaded = await uploadBuffer({ buffer: buf, contentType, ext, prefix });
    const m = await prisma.media.create({ data: { userId, type: isImage ? "image" : "video", url: uploaded.url, key: uploaded.key } });
    return NextResponse.json({ media: m }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Import failed" }, { status: 500 });
  }
}


