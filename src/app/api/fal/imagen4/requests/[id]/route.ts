import "dotenv/config";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { requireAuth } from "@/lib/server-auth";
import { uploadBuffer } from "@/lib/storage";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function extractFirstImageUrl(obj: any): string | null {
  if (!obj || typeof obj !== "object") return null;
  if (Array.isArray(obj)) {
    for (const it of obj) {
      const u = extractFirstImageUrl(it);
      if (u) return u;
    }
    return null;
  }
  if (typeof obj.url === "string" && obj.url.match(/^https?:\/\//)) return obj.url;
  if (Array.isArray(obj.images) && obj.images.length) {
    const u = extractFirstImageUrl(obj.images[0]);
    if (u) return u;
  }
  if (Array.isArray(obj.output) && obj.output.length) {
    const u = extractFirstImageUrl(obj.output[0]);
    if (u) return u;
  }
  if (obj.image && typeof obj.image === "string") return obj.image;
  return null;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    let userId: string | null = null;
    try {
      const nextAuthMod: any = await import("next-auth");
      const authMod: any = await import("@/lib/auth");
      const session: any = await nextAuthMod.getServerSession(authMod.authOptions);
      userId = session?.user?.id || null;
    } catch {}
    const falKey = process.env.FAL_KEY || env.FAL_KEY;
    if (!falKey) return NextResponse.json({ error: "FAL_KEY not configured", hasProcessEnv: !!process.env.FAL_KEY, hasParsedEnv: !!env.FAL_KEY }, { status: 500 });
    const res = await fetch(`https://queue.fal.run/fal-ai/imagen4/requests/${encodeURIComponent(params.id)}`, {
      headers: { "Authorization": `Key ${falKey}` },
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: `FAL result fetch failed: ${res.status}`, data }, { status: 500 });
    }

    const url = new URL(req.url);
    const save = url.searchParams.get("save");
    if (save) {
      const imageUrl = extractFirstImageUrl(data) || data?.image?.url || data?.image_url || (Array.isArray(data?.images) ? data.images[0]?.url : null) || null;
      if (!imageUrl) return NextResponse.json({ error: "No image URL in FAL response", data }, { status: 400 });
      const s3Configured = !!(process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
      // If object storage is not configured, avoid downloading/re-uploading and just save the external URL
      if (!s3Configured) {
        const canSaveToDb = !!(prisma as any)?.media?.create;
        if (userId && canSaveToDb) {
          try {
            const m = await prisma.media.create({ data: { userId, type: "image", url: imageUrl, key: null } });
            return NextResponse.json({ data, saved: { url: m.url, id: m.id }, note: "saved_external_url" }, { status: 200 });
          } catch {
            return NextResponse.json({ data, saved: { url: imageUrl, id: "anon" }, note: "saved_external_url" }, { status: 200 });
          }
        }
        return NextResponse.json({ data, saved: { url: imageUrl, id: "anon" }, note: "saved_external_url" }, { status: 200 });
      }
      try {
        const r = await fetch(imageUrl);
        if (!r.ok) throw new Error(`Image fetch failed: ${r.status}`);
        const contentType = r.headers.get("content-type") || "image/jpeg";
        const buf = Buffer.from(await r.arrayBuffer());
        const ext = contentType.includes("png") ? ".png" : contentType.includes("webp") ? ".webp" : contentType.includes("gif") ? ".gif" : ".jpg";
        const uploaded = await uploadBuffer({ buffer: buf, contentType, ext, prefix: "media" });
        const canSaveToDb = !!(prisma as any)?.media?.create;
        if (userId && canSaveToDb) {
          try {
            const m = await prisma.media.create({ data: { userId, type: "image", url: uploaded.url, key: uploaded.key } });
            return NextResponse.json({ data, saved: { url: m.url, id: m.id } }, { status: 200 });
          } catch (dbErr: any) {
            return NextResponse.json({ data, saved: { url: uploaded.url, id: "anon" }, note: "db_save_failed" }, { status: 200 });
          }
        }
        return NextResponse.json({ data, saved: { url: uploaded.url, id: "anon" } }, { status: 200 });
      } catch (e: any) {
        // Fallback: store external URL directly if download/upload fails
        const canSaveToDb = !!(prisma as any)?.media?.create;
        if (userId && canSaveToDb) {
          try {
            const m = await prisma.media.create({ data: { userId, type: "image", url: imageUrl, key: null } });
            return NextResponse.json({ data, saved: { url: m.url, id: m.id }, note: "saved_external_url" }, { status: 200 });
          } catch (dbErr: any) {
            return NextResponse.json({ data, saved: { url: imageUrl, id: "anon" }, note: "db_save_failed_saved_external_url" }, { status: 200 });
          }
        }
        return NextResponse.json({ data, saved: { url: imageUrl, id: "anon" }, note: "saved_external_url" }, { status: 200 });
      }
    }

    // No save: just return data and the best-guess image URL so the client can display immediately
    const imageUrl = extractFirstImageUrl(data) || data?.image?.url || data?.image_url || (Array.isArray(data?.images) ? data.images[0]?.url : null) || null;
    return NextResponse.json({ data, imageUrl }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "FAL error" }, { status: 500 });
  }
}


