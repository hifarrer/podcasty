import { NextRequest, NextResponse } from "next/server";
import { uploadBuffer } from "@/lib/storage";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const userId = await requireAuth();
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    const blob = file as unknown as Blob;
    const type = (blob.type || "").toLowerCase();
    const arrayBuf = await blob.arrayBuffer();
    const buf = Buffer.from(arrayBuf);
    if (buf.length === 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }
    // If text upload for TXT ingestion
    if (type === "text/plain") {
      // Limit ~35,000 characters (assuming UTF-8, ~ 70KB)
      if (buf.length > 70_000) {
        return NextResponse.json({ error: "TXT file exceeds 35,000 character limit" }, { status: 400 });
      }
      const { key, url } = await uploadBuffer({ buffer: buf, contentType: "text/plain", ext: ".txt", prefix: "uploads" });
      return NextResponse.json({ key, url }, { status: 201 });
    }
    // If image upload for gallery
    if (type.startsWith("image/")) {
      const ext = type.includes("png") ? ".png" : type.includes("webp") ? ".webp" : type.includes("gif") ? ".gif" : ".jpg";
      const { key, url } = await uploadBuffer({ buffer: buf, contentType: type, ext, prefix: "media" });
      await prisma.media.create({ data: { userId, type: "image", url, key } });
      return NextResponse.json({ key, url }, { status: 201 });
    }
    return NextResponse.json({ error: "Unsupported content type" }, { status: 400 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


