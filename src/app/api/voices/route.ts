import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export async function GET() {
  if (!env.ELEVENLABS_API_KEY) return NextResponse.json({ voices: [] });
  const res = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": env.ELEVENLABS_API_KEY },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text }, { status: 500 });
  }
  const data = await res.json();
  const voices = (data.voices || []).map((v: any) => ({
    voice_id: v.voice_id,
    name: v.name,
    preview_url: v.preview_url || null,
  }));
  return NextResponse.json({ voices });
}




