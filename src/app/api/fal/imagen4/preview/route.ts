import "dotenv/config";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
// Auth not required here; generation can be done pre-auth

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prompt = body?.prompt;
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "prompt required" }, { status: 400 });
    }
    const falKey = process.env.FAL_KEY || (process.env as any).fal_key || env.FAL_KEY;
    if (!falKey) return NextResponse.json({ error: "FAL_KEY not configured", hasProcessEnv: !!process.env.FAL_KEY, hasLowerProcessEnv: !!(process.env as any).fal_key, hasParsedEnv: !!env.FAL_KEY }, { status: 500 });
    const res = await fetch("https://queue.fal.run/fal-ai/imagen4/preview", {
      method: "POST",
      headers: { "Authorization": `Key ${falKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, aspect_ratio: "16:9" }),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "FAL error" }, { status: 500 });
  }
}


