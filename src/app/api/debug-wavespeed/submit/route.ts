import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

export async function POST(request: NextRequest) {
  try {
    console.log("[DEBUG] Submitting to Wavespeed API...");
    
    const wavespeedResponse = await fetch("https://api.wavespeed.ai/api/v3/wavespeed-ai/multitalk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.WAVESPEED_KEY}`,
      },
      body: JSON.stringify({
        audio: "https://podcasty-lime.vercel.app/api/proxy/episodes%2F9b388262-4e90-4077-b3fc-d73f3369ac69.mp3",
        image: "https://podcasty-lime.vercel.app/assets/images/p8.jpg",
        prompt: "a person talking in a podcast",
        seed: -1,
      }),
    });

    console.log("[DEBUG] Wavespeed response status:", wavespeedResponse.status);
    
    const responseBody = await wavespeedResponse.json();
    console.log("[DEBUG] Wavespeed response body:", JSON.stringify(responseBody, null, 2));

    if (!wavespeedResponse.ok) {
      console.log("[DEBUG] Wavespeed API error:", responseBody);
      return NextResponse.json(
        { error: "Wavespeed API error", details: responseBody },
        { status: wavespeedResponse.status }
      );
    }

    return NextResponse.json(responseBody);
  } catch (error) {
    console.error("[DEBUG] Error submitting to Wavespeed:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error },
      { status: 500 }
    );
  }
}
