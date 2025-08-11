import { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest, { params }: { params: { key: string[] } }) {
  const key = decodeURIComponent(params.key.join("/"));
  const range = req.headers.get("range") || undefined;

  // If S3 configured, proxy from S3
  if (env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY) {
    const s3 = new S3Client({
      region: env.S3_REGION || "us-east-1",
      endpoint: env.S3_ENDPOINT,
      credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
      forcePathStyle: !!env.S3_ENDPOINT && !env.S3_ENDPOINT.includes("amazonaws.com"),
    });
    const cmd = new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Range: range });
    const res = await s3.send(cmd);
    const body = res.Body as any; // stream
    const headers = new Headers();
    headers.set("Content-Type", "audio/mpeg");
    if (res.ContentLength != null) headers.set("Content-Length", String(res.ContentLength));
    if (res.ContentRange) headers.set("Content-Range", res.ContentRange);
    if (range) headers.set("Accept-Ranges", "bytes");
    return new Response(body as any, { status: range ? 206 : 200, headers });
  }

  // Local dev fallback: file saved to public/uploads with slashes replaced by underscore
  const filename = key.replaceAll("/", "_");
  const filePath = path.join(process.cwd(), "public", "uploads", filename);
  try {
    const stat = await fsp.stat(filePath);
    const total = stat.size;
    const headers = new Headers();
    headers.set("Content-Type", "audio/mpeg");
    headers.set("Accept-Ranges", "bytes");

    if (range) {
      const m = /bytes=(\d+)-(\d+)?/.exec(range);
      const start = m ? parseInt(m[1], 10) : 0;
      const end = m && m[2] ? parseInt(m[2], 10) : total - 1;
      if (start >= total || end >= total) {
        // Respond with 200 and full content for browsers that may send invalid initial ranges
        headers.set("Content-Length", String(total));
        const stream = fs.createReadStream(filePath);
        return new Response(stream as any, { status: 200, headers });
      }
      const chunkSize = end - start + 1;
      headers.set("Content-Range", `bytes ${start}-${end}/${total}`);
      headers.set("Content-Length", String(chunkSize));
      const stream = fs.createReadStream(filePath, { start, end });
      return new Response(stream as any, { status: 206, headers });
    }

    headers.set("Content-Length", String(total));
    const stream = fs.createReadStream(filePath);
    return new Response(stream as any, { status: 200, headers });
  } catch (e) {
    return new Response("Not found", { status: 404 });
  }
}


