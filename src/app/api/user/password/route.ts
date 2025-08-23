import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/server-auth";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const body = await req.json().catch(() => ({}));
    const { currentPassword, newPassword } = body || {};

    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { password: true } });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // If a password exists, verify current password
    if (user.password) {
      if (!currentPassword || typeof currentPassword !== "string") {
        return NextResponse.json({ error: "Current password is required" }, { status: 400 });
      }
      const ok = await bcrypt.compare(currentPassword, user.password);
      if (!ok) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
    return NextResponse.json({ ok: true });
  } catch (_e: unknown) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
}
