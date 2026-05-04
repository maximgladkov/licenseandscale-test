import { jsonError, routeError } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Params) {
  try {
    const { id } = await ctx.params;
    const found = await prisma.draft.findUnique({ where: { id } });
    if (!found || found.status !== "SCHEDULED") {
      return jsonError(400, "Draft is not scheduled");
    }
    const draft = await prisma.draft.update({
      where: { id },
      data: { status: "COMPLETED" },
    });
    return NextResponse.json({ draft });
  } catch (e) {
    return routeError(e, { fallbackMessage: "Complete failed", status: 400 });
  }
}
