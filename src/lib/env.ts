import { z } from "zod";

const envSchema = z.object({
  // Make DATABASE_URL optional at build time to avoid throwing during Next/Vercel static analysis.
  // Runtime code that requires the database should ensure this is set.
  DATABASE_URL: z.string().url().optional(),
  AUTH_SECRET: z.string().min(10).optional(),
  NEXTAUTH_SECRET: z.string().min(10).optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  // For local dev, allow http URL
  // Note: We keep this optional and do not parse here to avoid crashing dev if not set

  REDIS_URL: z.string().optional(),
  UPSTASH_REDIS_URL: z.string().optional(),
  UPSTASH_REDIS_TOKEN: z.string().optional(),

  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),

  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().optional(),

  APP_URL: z.string().url().optional(),
  PUBLIC_CDN_URL: z.string().url().optional(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Email (SMTP)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  // Email (Resend)
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().optional(),
});

export const env = envSchema.parse(process.env);


