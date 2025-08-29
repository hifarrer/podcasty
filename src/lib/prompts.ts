export const SCRIPT_WRITER_PROMPT = (
  raw: string,
  opts: {
    mode: "SUMMARY" | "READTHROUGH" | "DISCUSSION";
    targetMinutes?: number;
    language: string;
    style: string;
    twoSpeakers?: boolean;
    speakerNameA?: string;
    speakerNameB?: string;
    generateVideo?: boolean;
  }
) => `You are a podcast scriptwriter. Transform the provided content into a structured podcast script.
- Output SSML suitable for TTS.
- Tone/style: ${opts.style}; Language: ${opts.language}.
- Mode: ${opts.mode}. ${opts.mode === "SUMMARY" ? `Aim for ~${opts.targetMinutes || 1} minutes.` : ""}
- Structure:
  <intro hook>, <context>, <sectioned narrative with transitions>, <clear chapter headings>, <outro>.
- Use <break time="xxxms"/> for pacing; avoid overlong sentences.
${opts.mode === "DISCUSSION" ? `- Write as a lively discussion between two speakers A and B with differing viewpoints about the topic (one generally in favor, the other against). SAFETY: If the topic would violate OpenAI guidelines to present opposing sides (e.g., abuse, mass murder), do NOT present opposing views—instead have both speakers clearly condemn harmful/illegal acts and discuss responsibly. A opens the show, introduces B by NAME, then B greets. ${opts.speakerNameA || opts.speakerNameB ? `Use these speaker names: A=${opts.speakerNameA || 'A-Name'}, B=${opts.speakerNameB || 'B-Name'}.` : `Assign natural, human names to A and B.`} Keep turns short (1–3 sentences), alternate naturally, and prefix each turn with "A:" or "B:" ONLY (no names inline).` : (opts.twoSpeakers ? `- Write as a dialogue between two speakers labeled A and B. ${opts.speakerNameA || opts.speakerNameB ? `Use these speaker names: A=${opts.speakerNameA || 'A-Name'}, B=${opts.speakerNameB || 'B-Name'}.` : `Assign human names to both.`} Prefix each spoken turn with "A:" or "B:" ONLY (no names inline).` : `- Write as a single narrator.`)}
Return JSON ONLY in the following shape (ensure turns are labeled strictly with A or B, not names).${opts.generateVideo ? ` Additionally, split the spoken content into exactly ${Math.max(1, Math.floor((opts.targetMinutes || 1) * 2))} parts (one part per 30 seconds of target duration), returning a key-indexed object where keys are 1..N and values are phrases that take approximately 30 seconds each at the estimated_wpm. For example, a 1-minute target should have 2 parts, a 2-minute target should have 4 parts, etc. The split should cover the whole narration flow from intro to outro. Name this field parts30s.` : ''}
{
  "title": "...",
  "ssml": "<speak>...</speak>",
  "chapters": [{"title":"...","hint":"one-line summary"}],
  "show_notes": "2–4 short paragraphs + bullet takeaways",
  "estimated_wpm": 150
  ,"speaker_names": {"A": "NameA", "B": "NameB"},
  "turns": [{"speaker": "A", "text": "first short turn"}]
  ${opts.generateVideo ? `,"parts30s": {"1":"...","2":"..."}` : ''}
}
Keep brand names and quotes minimal; paraphrase vs. verbatim.

CONTENT START\n${raw}\nCONTENT END`;

export const SHOW_NOTES_POLISHER = `Improve clarity and SEO for the show notes. Add 5–10 keywords. Return markdown only.`;

export const CHAPTER_TIMESTAMP_ESTIMATOR = `Given SSML and estimated_wpm, estimate startMs per chapter and return updated chapter array.`;


