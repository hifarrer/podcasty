import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { SCRIPT_WRITER_PROMPT } from "@/lib/prompts";

const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;
const anthropic = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null as any;

export async function generateScript(raw: string, opts: {
  mode: "SUMMARY" | "READTHROUGH" | "DISCUSSION";
  targetMinutes?: number;
  language: string;
  style: string;
  twoSpeakers?: boolean;
  speakerNameA?: string;
  speakerNameB?: string;
}) {
  const prompt = SCRIPT_WRITER_PROMPT(raw, opts);
  const responseText = await callAnyLLM(prompt);
  const jsonStart = responseText.indexOf("{");
  const jsonEnd = responseText.lastIndexOf("}") + 1;
  const json = JSON.parse(responseText.slice(jsonStart, jsonEnd));
  return json as {
    title: string;
    ssml: string;
    chapters: { title: string; hint: string }[];
    show_notes: string;
    estimated_wpm: number;
    speaker_names?: { A: string; B: string };
    turns?: { speaker: "A" | "B"; text: string }[];
    parts30s?: Record<string, string>;
  };
}

async function callAnyLLM(prompt: string): Promise<string> {
  if (openai) {
    const chat = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });
    return chat.choices[0]?.message?.content || "";
  }
  if (anthropic) {
    const msg = await anthropic.messages.create({
      model: "claude-3-5-sonnet-latest",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });
    return msg.content?.[0]?.text || "";
  }
  throw new Error("No LLM configured");
}


