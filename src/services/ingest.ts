import axios from "axios";
import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import ytdl from "ytdl-core";

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
    const info = await withTimeout(ytdl.getBasicInfo(url), 10000, "ytdl.getBasicInfo");
    const title = info.videoDetails.title;
    const desc = info.videoDetails.description;
    return normalizeText(`# ${title}\n\n${desc}`);
  } catch (_e) {
    // Fallback: scrape basic meta tags to avoid hanging the pipeline
    try {
      const res = await axios.get(url, {
        timeout: 10000,
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      });
      const $ = cheerio.load(res.data as string);
      const title = $('meta[property="og:title"]').attr("content") || $("title").text() || "YouTube Video";
      const desc = $('meta[property="og:description"]').attr("content") || "";
      return normalizeText(`# ${title}\n\n${desc}`);
    } catch {
      // Last resort: proceed with URL only
      return `YouTube video: ${url}`;
    }
  }
}

export function normalizeText(input: string): string {
  return input
    .replace(/\s+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}


