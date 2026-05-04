import { routeError } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const exemplars = await prisma.exemplar.findMany({
      orderBy: { createdAt: "desc" },
      take: 400,
      select: {
        id: true,
        kind: true,
        channel: true,
        rating: true,
        content: true,
        reason: true,
        sourceDraftId: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ exemplars });
  } catch (e) {
    return routeError(e, { fallbackMessage: "Failed to load exemplars" });
  }
}
