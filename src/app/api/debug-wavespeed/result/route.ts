import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get("requestId");

    if (!requestId) {
      return NextResponse.json(
        { error: "requestId parameter is required" },
        { status: 400 }
      );
    }

    console.log("[DEBUG] Querying Wavespeed result for requestId:", requestId);
    
    const wavespeedResponse = await fetch(`https://api.wavespeed.ai/api/v3/predictions/${requestId}/result`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${env.WAVESPEED_KEY}`,
      },
    });

    console.log("[DEBUG] Wavespeed result response status:", wavespeedResponse.status);
    
    const responseBody = await wavespeedResponse.json();
    console.log("[DEBUG] Wavespeed result response body:", JSON.stringify(responseBody, null, 2));

    if (!wavespeedResponse.ok) {
      console.log("[DEBUG] Wavespeed API error:", responseBody);
      return NextResponse.json(
        { error: "Wavespeed API error", details: responseBody },
        { status: wavespeedResponse.status }
      );
    }

    return NextResponse.json(responseBody);
  } catch (error) {
    console.error("[DEBUG] Error querying Wavespeed result:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error },
      { status: 500 }
    );
  }
}
