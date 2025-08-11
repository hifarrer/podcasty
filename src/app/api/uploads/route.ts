import { NextRequest, NextResponse } from "next/server";
import { uploadBuffer } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    const blob = file as unknown as Blob;
    const type = (blob.type || "").toLowerCase();
    if (type && type !== "text/plain") {
      return NextResponse.json({ error: "Only text/plain is supported" }, { status: 400 });
    }
    const arrayBuf = await blob.arrayBuffer();
    const buf = Buffer.from(arrayBuf);
    if (buf.length === 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }
  // Limit ~35,000 characters (assuming UTF-8, be generous to bytes ~ 70KB)
  if (buf.length > 70_000) {
    return NextResponse.json({ error: "TXT file exceeds 35,000 character limit" }, { status: 400 });
  }
    const { key, url } = await uploadBuffer({ buffer: buf, contentType: "text/plain", ext: ".txt", prefix: "uploads" });
    return NextResponse.json({ key, url }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


