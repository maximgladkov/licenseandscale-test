import { routeError } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const [positive, negative, byKindRating] = await Promise.all([
      prisma.exemplar.count({ where: { rating: "POSITIVE" } }),
      prisma.exemplar.count({ where: { rating: "NEGATIVE" } }),
      prisma.exemplar.groupBy({
        by: ["kind", "rating"],
        _count: { _all: true },
      }),
    ]);

    return NextResponse.json({
      totals: { positive, negative },
      byKindRating,
    });
  } catch (e) {
    return routeError(e, { fallbackMessage: "Failed to load stats" });
  }
}
