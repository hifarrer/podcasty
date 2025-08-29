import axios from "axios";
import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import ytdl from "ytdl-core";

// YouTube Transcript API - using require to avoid TypeScript issues
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { YoutubeTranscript } = require('youtube-transcript-api') as any;

async function withTimeout<T>(promise: Promise<T>, ms: number, label = "operation"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(t);
        reject(e);
      });
  });
}

export async function ingestFromUrl(url: string): Promise<string> {
  const res = await axios.get(url, { timeout: 20000 });
  const html = res.data as string;
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  const text = [article?.title, article?.textContent].filter(Boolean).join("\n\n");
  return normalizeText(text);
}

export async function ingestFromYouTube(url: string): Promise<string> {
  try {
    // Extract video ID from URL
    const videoId = extractVideoId(url);
    if (!videoId) {
      throw new Error("Invalid YouTube URL");
    }

    // Get video info
    const info = await withTimeout(ytdl.getBasicInfo(url), 10000, "ytdl.getBasicInfo");
    const title = info.videoDetails.title;
    const desc = info.videoDetails.description;

    // Try to get transcript
    let transcript = "";
    try {
      const transcriptList = await withTimeout(YoutubeTranscript.fetchTranscript(videoId), 15000, "transcript.fetch");
      if (transcriptList && Array.isArray(transcriptList)) {
        transcript = transcriptList.map((item: any) => item.text).join(" ");
      }
    } catch (transcriptError: any) {
      console.log(`[ingest] Transcript not available for video ${videoId}:`, transcriptError.message);
    }

    // Combine title, description, and transcript
    const content = [
      `# ${title}`,
      desc && desc.length > 100 ? desc : "", // Only include description if it's substantial
      transcript
    ].filter(Boolean).join("\n\n");

    const normalizedContent = normalizeText(content);
    
    // Validate we have sufficient content
    if (normalizedContent.length < 100) {
      throw new Error("Insufficient content extracted from YouTube video");
    }

    return normalizedContent;
  } catch (error: any) {
    console.log(`[ingest] YouTube ingestion error:`, error.message);
    
    // Fallback: scrape basic meta tags
    try {
      const res = await axios.get(url, {
        timeout: 10000,
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      });
      const $ = cheerio.load(res.data as string);
      const title = $('meta[property="og:title"]').attr("content") || $("title").text() || "YouTube Video";
      const desc = $('meta[property="og:description"]').attr("content") || "";
      const fallbackContent = normalizeText(`# ${title}\n\n${desc}`);
      
      if (fallbackContent.length < 50) {
        throw new Error("Fallback content too short");
      }
      
      return fallbackContent;
    } catch (fallbackError: any) {
      console.log(`[ingest] Fallback also failed:`, fallbackError.message);
      throw new Error(`Failed to extract content from YouTube video: ${error.message}`);
    }
  }
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

export function normalizeText(input: string): string {
  return input
    .replace(/\s+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}


