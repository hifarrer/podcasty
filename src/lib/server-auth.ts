import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

export async function getCurrentUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    throw new Error("Authentication required");
  }

  // Ensure feed exists for authenticated user
  const existingFeed = await prisma.feed.findUnique({ where: { userId: session.user.id } });
  if (!existingFeed) {
    await prisma.feed.create({
      data: {
        userId: session.user.id,
        privateToken: randomUUID(),
      },
    });
  }

  return session.user.id;
}

export async function requireAuth(): Promise<string> {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    throw new Error("Authentication required");
  }

  return session.user.id;
}

// Function for creating episodes without requiring authentication (for demo/guest users)
export async function getCurrentUserIdOrDemo(): Promise<string> {
  const session = await getServerSession(authOptions);
  
  if (session?.user?.id) {
    // Ensure feed exists for authenticated user
    const existingFeed = await prisma.feed.findUnique({ where: { userId: session.user.id } });
    if (!existingFeed) {
      await prisma.feed.create({
        data: {
          userId: session.user.id,
          privateToken: randomUUID(),
        },
      });
    }
    return session.user.id;
  }

  // For demo/guest users, create a unique demo user ID
  const demoUserId = `demo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  await prisma.user.upsert({
    where: { id: demoUserId },
    update: {},
    create: {
      id: demoUserId,
      name: "Guest User",
      email: null,
    },
  });
  
  // Ensure feed exists
  const existingFeed = await prisma.feed.findUnique({ where: { userId: demoUserId } });
  if (!existingFeed) {
    await prisma.feed.create({
      data: {
        userId: demoUserId,
        privateToken: randomUUID(),
      },
    });
  }
  
  return demoUserId;
}
