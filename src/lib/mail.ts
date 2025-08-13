import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { env } from "@/lib/env";
import { Resend } from "resend";

let cachedTransporter: Transporter | null = null;
let cachedResend: Resend | null = null;

export function getMailer(): Transporter | null {
  if (cachedTransporter) return cachedTransporter;
  const host = env.SMTP_HOST;
  const port = env.SMTP_PORT ? Number(env.SMTP_PORT) : undefined;
  const user = env.SMTP_USER;
  const pass = env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return cachedTransporter;
}

function getResend(): Resend | null {
  if (cachedResend) return cachedResend;
  if (!env.RESEND_API_KEY) return null;
  cachedResend = new Resend(env.RESEND_API_KEY);
  return cachedResend;
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  fromOverride?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const resend = getResend();
  const smtp = getMailer();

  // Prefer Resend if configured, else fallback to SMTP, else error
  try {
    if (resend) {
      const from = options.fromOverride || env.RESEND_FROM || env.SMTP_FROM || options.to;
      const { error } = await resend.emails.send({
        from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      } as any);
      if (error) return { ok: false, error: error.message || "Resend send failed" };
      return { ok: true };
    }

    if (smtp) {
      const from = options.fromOverride || env.SMTP_FROM || options.to;
      await smtp.sendMail({ from, to: options.to, subject: options.subject, text: options.text, html: options.html });
      return { ok: true };
    }

    return { ok: false, error: "Email not configured" };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Failed to send" };
  }
}


