import { jsonError, routeError } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Params) {
  try {
    const { id } = await ctx.params;
    const draft = await prisma.draft.findUnique({ where: { id } });
    if (!draft) {
      return jsonError(404, "Draft not found");
    }
    return NextResponse.json({ draft });
  } catch (e) {
    return routeError(e, { fallbackMessage: "Failed to load draft" });
  }
}
