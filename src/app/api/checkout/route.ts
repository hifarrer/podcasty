import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { env } from "@/lib/env";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({} as any));
    const { priceId, successUrl, cancelUrl } = body || {};
    if (!priceId) return NextResponse.json({ error: "Missing priceId" }, { status: 400 });

    if (!env.STRIPE_SECRET_KEY) return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    const stripe = new Stripe(env.STRIPE_SECRET_KEY);

    const baseUrl = successUrl || process.env.NEXTAUTH_URL || process.env.APP_URL || "http://localhost:3000";
    const cancelBase = cancelUrl || baseUrl;

    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/profile?checkout=success`,
      cancel_url: `${cancelBase}/pricing?checkout=cancel`,
      client_reference_id: session.user.id,
      customer_email: session.user.email || undefined,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: checkout.url });
  } catch (e: any) {
    console.error("Checkout create error:", e);
    return NextResponse.json({ error: e.message || "Checkout error" }, { status: 500 });
  }
}


