import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      generateVideo: true, // Only video episodes
    };

    if (status && status !== "all") {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ];
    }

    // Get video episodes with user info
    const [episodes, totalCount] = await Promise.all([
      prisma.episode.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              plan: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.episode.count({ where }),
    ]);

    // Get status counts for filtering
    const statusCounts = await prisma.episode.groupBy({
      by: ["status"],
      where: { generateVideo: true },
      _count: { status: true },
    });

    const statusStats = statusCounts.reduce((acc, item) => {
      acc[item.status] = item._count.status;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      episodes,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      statusStats,
    });
  } catch (error) {
    console.error("Error fetching video episodes:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
