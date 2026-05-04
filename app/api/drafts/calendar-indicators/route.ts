import { jsonInvalidQuery, routeError } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const Query = z.object({
  tz: z.string().min(1).max(120),
});

function utcToCalendarDay(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export async function GET(req: Request) {
  const qp = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!qp.success) {
    return jsonInvalidQuery();
  }
  const tz = qp.data.tz;
  try {
    const rows = await prisma.draft.findMany({
      where: { status: "SCHEDULED", scheduledFor: { not: null } },
      select: { scheduledFor: true },
    });
    const indicators: Record<string, number> = {};
    for (const r of rows) {
      if (!r.scheduledFor) continue;
      const day = utcToCalendarDay(r.scheduledFor, tz);
      indicators[day] = (indicators[day] ?? 0) + 1;
    }
    return NextResponse.json({ indicators });
  } catch (e) {
    return routeError(e, { fallbackMessage: "Failed to load indicators" });
  }
}
