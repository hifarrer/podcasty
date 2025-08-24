import "dotenv/config";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
// Auth not required here; allow polling pre-auth

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const falKey = process.env.FAL_KEY || env.FAL_KEY;
    if (!falKey) return NextResponse.json({ error: "FAL_KEY not configured", hasProcessEnv: !!process.env.FAL_KEY, hasParsedEnv: !!env.FAL_KEY }, { status: 500 });
    const res = await fetch(`https://queue.fal.run/fal-ai/imagen4/requests/${encodeURIComponent(params.id)}/status`, {
      headers: { "Authorization": `Key ${falKey}` },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "FAL error" }, { status: 500 });
  }
}


