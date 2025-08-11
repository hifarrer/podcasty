import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";
import { randomUUID } from "crypto";
import fs from "node:fs/promises";
import path from "node:path";

let s3: S3Client | null = null;
if (env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY && env.S3_BUCKET) {
  s3 = new S3Client({
    region: env.S3_REGION || "us-east-1",
    endpoint: env.S3_ENDPOINT,
    credentials: env.S3_ACCESS_KEY_ID
      ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY! }
      : undefined,
    forcePathStyle: !!env.S3_ENDPOINT && !env.S3_ENDPOINT.includes("amazonaws.com"),
  });
}

export async function uploadBuffer(opts: {
  buffer: Buffer;
  contentType: string;
  ext: string;
  prefix?: string;
}): Promise<{ url: string; key: string }> {
  const key = `${opts.prefix || "episodes"}/${randomUUID()}.${opts.ext.replace(/^\./, "")}`;
  if (s3 && env.S3_BUCKET) {
    await s3.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: opts.buffer,
        ContentType: opts.contentType,
      })
    );
    const base = env.APP_URL || "";
    const url = `${base}/api/proxy/${encodeURIComponent(key)}`;
    return { url, key };
  }
  // Fallback: write to public dir in dev
  const publicDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(publicDir, { recursive: true });
  const filePath = path.join(publicDir, key.replaceAll("/", "_"));
  await fs.writeFile(filePath, opts.buffer);
  const url = `/api/proxy/${encodeURIComponent(key)}`;
  return { url, key };
}


