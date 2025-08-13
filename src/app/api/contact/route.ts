import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getPrisma() {
  const { prisma } = await import("@/lib/prisma");
  return prisma;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name: string = (body?.name || "").toString();
    const email: string = (body?.email || "").toString();
    const message: string = (body?.message || "").toString();

    if (!name || !email || !message) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const prisma = await getPrisma();
    const settings = await prisma.siteSettings.findUnique({ where: { id: "main" } });
    const to = settings?.siteEmail;
    if (!to) {
      return NextResponse.json({ error: "Site email not configured" }, { status: 500 });
    }

    const subject = `New contact form submission from ${name}`;
    const text = `From: ${name} <${email}>

${message}`;
    const html = `<p><strong>From:</strong> ${name} &lt;${email}&gt;</p><pre>${escapeHtml(message)}</pre>`;

    const result = await sendEmail({ to, subject, text, html });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}


