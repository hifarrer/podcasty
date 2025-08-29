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

// Retry function with exponential backoff
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 1000): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      if (attempt === maxRetries) throw error;
      
      // Don't retry on certain errors
      if (error.message?.includes('Invalid YouTube URL') || 
          error.message?.includes('Insufficient content') ||
          error.message?.includes('Fallback content too short')) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`[ingest] Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
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
  return withRetry(async () => {
    try {
      // Extract video ID from URL
      const videoId = extractVideoId(url);
      if (!videoId) {
        throw new Error("Invalid YouTube URL");
      }

      console.log(`[ingest] Processing YouTube video: ${videoId}`);

      // At this point, videoId is guaranteed to be a string
      const safeVideoId = videoId as string;

      // Method 1: Try ytdl-core with better headers
      let title = "";
      let desc = "";
      try {
        const info = await withTimeout(ytdl.getBasicInfo(url, {
          requestOptions: {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
              'Accept-Encoding': 'gzip, deflate',
              'DNT': '1',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1',
            }
          }
        }), 15000, "ytdl.getBasicInfo");
        
        title = info.videoDetails.title;
        desc = info.videoDetails.description || "";
        console.log(`[ingest] Successfully extracted title: ${title}`);
      } catch (ytdlError: any) {
        console.log(`[ingest] ytdl-core failed:`, ytdlError.message);
      }

      // Method 2: Try transcript API
      let transcript = "";
      try {
        const transcriptList = await withTimeout(YoutubeTranscript.fetchTranscript(videoId, {
          lang: 'en',
          country: 'US'
        }), 15000, "transcript.fetch");
        
        if (transcriptList && Array.isArray(transcriptList)) {
          transcript = transcriptList.map((item: any) => item.text).join(" ");
          console.log(`[ingest] Successfully extracted transcript (${transcript.length} chars)`);
        }
      } catch (transcriptError: any) {
        console.log(`[ingest] Transcript not available for video ${videoId}:`, transcriptError.message);
      }

      // Method 3: Fallback to web scraping if we don't have title
      if (!title) {
        try {
          const res = await axios.get(url, {
            timeout: 15000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
              'Accept-Encoding': 'gzip, deflate',
              'DNT': '1',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1',
            },
          });
          
          const $ = cheerio.load(res.data as string);
          title = $('meta[property="og:title"]').attr("content") || 
                  $('meta[name="title"]').attr("content") ||
                  $("title").text() || 
                  "YouTube Video";
          desc = $('meta[property="og:description"]').attr("content") || 
                 $('meta[name="description"]').attr("content") || 
                 "";
          
          console.log(`[ingest] Successfully scraped title: ${title}`);
        } catch (scrapeError: any) {
          console.log(`[ingest] Web scraping failed:`, scrapeError.message);
        }
      }

      // Combine all available content
      const content = [
        title ? `# ${title}` : "",
        desc && desc.length > 50 ? desc : "", // Only include description if it's substantial
        transcript
      ].filter(Boolean).join("\n\n");

      const normalizedContent = normalizeText(content);
      
      console.log(`[ingest] Final content length: ${normalizedContent.length} chars`);
      
      // Validate we have sufficient content
      if (normalizedContent.length < 50) {
        throw new Error("Insufficient content extracted from YouTube video");
      }

      return normalizedContent;
    } catch (error: any) {
      console.log(`[ingest] YouTube ingestion error:`, error.message);
      
             // Final fallback: return a basic structure
       const videoId = extractVideoId(url) ?? 'unknown';
       const fallbackContent = `# YouTube Video\n\nThis is a YouTube video (ID: ${videoId}). The content could not be automatically extracted due to YouTube's API restrictions. Please provide a text prompt or description of the video content you'd like to create a podcast about.`;
      
      console.log(`[ingest] Using fallback content`);
      return fallbackContent;
    }
  });
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


