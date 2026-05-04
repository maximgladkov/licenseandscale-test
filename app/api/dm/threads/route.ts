import { jsonInvalidQuery, routeError } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const Query = z.object({
  unresolvedOnly: z.enum(["true", "false"]).optional(),
});

export async function GET(req: Request) {
  const q = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!q.success) return jsonInvalidQuery();

  try {
    const threads = await prisma.dmThread.findMany({
      where: q.data.unresolvedOnly === "true" ? { isResolved: false } : undefined,
      include: {
        messages: {
          orderBy: { id: "asc" },
        },
      },
      orderBy: [{ isResolved: "asc" }, { id: "asc" }],
    });

    return NextResponse.json({ threads });
  } catch (e) {
    return routeError(e, { fallbackMessage: "Failed to load threads" });
  }
}
