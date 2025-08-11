import { env } from "@/lib/env";

export async function synthesizeSsml(ssml: string, voiceId?: string): Promise<Buffer> {
  if (!env.ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY not set");
  const voice = voiceId || env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // default fallback
  const cleaned = ssml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const baseText = cleaned.length >= 20 ? cleaned : "This is an auto-generated podcast summary.";

  async function call(model: string, txt: string) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
      method: "POST",
      headers: {
        "xi-api-key": env.ELEVENLABS_API_KEY || "",
        accept: "audio/mpeg",
        "content-type": "application/json",
      },
      body: JSON.stringify({ text: txt, model_id: model, output_format: "mp3_44100_160" }),
    });
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`ElevenLabs TTS failed: ${res.status} ${errTxt}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  // Try preferred model, then fallback once if too short
  let mp3 = await call("eleven_multilingual_v2", baseText);
  if (mp3.length < 4000) {
    const extended = baseText + " " + baseText;
    mp3 = await call("eleven_turbo_v2", extended);
  }
  return mp3;
}

export async function synthesizeDialogueAb(
  ssml: string,
  voiceIdA: string,
  voiceIdB: string,
  speakerNames?: { A?: string; B?: string },
  turns?: { speaker: "A" | "B"; text: string }[],
): Promise<Buffer> {
  if (!env.ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY not set");
  // 1) Normalize to plain text
  let txt = ssml.replace(/<[^>]+>/g, " ").replace(/[\t ]+/g, " ").replace(/\r\n/g, "\n").trim();
  // 2) If names provided, rewrite "Name:" to A:/B: globally so downstream is unambiguous
  if (speakerNames) {
    const map: Record<string, "A" | "B"> = {};
    if (speakerNames.A) map[speakerNames.A.toLowerCase()] = "A";
    if (speakerNames.B) map[speakerNames.B.toLowerCase()] = "B";
    for (const n of Object.keys(map)) {
      const who = map[n];
      const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`(^|[\\n\\r\u201c“"'(])\\s*${esc}\\s*[:\\-–—]`, "gi");
      txt = txt.replace(re, (_m, p1) => `${p1}${who}:`);
    }
  }
  // 3) Build segments from structured turns if provided, else fallback to parsing
  const segs: { s: "A" | "B"; t: string }[] = [];
  if (Array.isArray(turns) && turns.length > 0) {
    for (const tr of turns) {
      if (tr && (tr.speaker === "A" || tr.speaker === "B") && tr.text) {
        segs.push({ s: tr.speaker, t: tr.text.trim() });
      }
    }
  }
  if (segs.length === 0) {
    const lines = txt.split(/\n+/);
    const labelLine = /^\s*([AB])\s*[:\-–—]\s*(.*)$/;
    let current: { s: "A" | "B"; t: string } | null = null;
    for (const raw of lines) {
      const line = raw.trim();
      const m = line.match(labelLine);
      if (m) {
        if (current && current.t.trim()) segs.push({ s: current.s, t: current.t.trim() });
        current = { s: m[1] as "A" | "B", t: (m[2] || "").trim() };
      } else if (current && line) {
        current.t += (current.t ? " " : "") + line;
      }
    }
    if (current && current.t.trim()) segs.push({ s: current.s, t: current.t.trim() });
  }
  if (segs.length === 0) {
    const sentences = txt.split(/(?<=[.!?])\s+/).filter(Boolean);
    sentences.forEach((s, i) => segs.push({ s: i % 2 === 0 ? "A" : "B", t: s.trim() }));
  }
  // 4) Synthesize per segment with explicit voices
  async function callEleven(voiceId: string, text: string) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": env.ELEVENLABS_API_KEY || "",
        accept: "audio/mpeg",
        "content-type": "application/json",
      },
      body: JSON.stringify({ text, model_id: "eleven_multilingual_v2", output_format: "mp3_44100_160" }),
    });
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`ElevenLabs TTS failed: ${res.status} ${errTxt}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }
  const out: Buffer[] = [];
  for (const seg of segs) {
    const voice = seg.s === "A" ? voiceIdA : voiceIdB;
    let text = seg.t;
    // Never speak labels or names; ensure they are stripped
    text = text.replace(/^\s*(?:[AB]|\(?[A-Z][A-Za-z\-']{1,20}\)?)\s*[:\-–—]\s+/, "");
    // Optionally replace stray single-letter mentions A/B with real names in flowing text
    if (speakerNames) {
      if (speakerNames.A) text = text.replace(/\bA\b/g, speakerNames.A);
      if (speakerNames.B) text = text.replace(/\bB\b/g, speakerNames.B);
    }
    const b = await callEleven(voice, text);
    out.push(b);
  }
  return Buffer.concat(out);
}


