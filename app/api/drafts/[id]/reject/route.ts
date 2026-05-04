import { routeError } from "@/lib/api-route";
import { persistExemplar } from "@/lib/exemplars";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const Body = z.object({
  reason: z.string().min(1),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Params) {
  try {
    const { id } = await ctx.params;
    const { reason } = Body.parse(await req.json());
    const draft = await prisma.draft.update({
      where: { id, status: "PENDING" },
      data: { status: "REJECTED" },
    });

    await persistExemplar({
      kind: draft.kind,
      channel: draft.channel,
      rating: "NEGATIVE",
      content: draft.content,
      sourceDraftId: draft.id,
      reason,
    });

    const updated = await prisma.draft.findUniqueOrThrow({ where: { id } });
    return NextResponse.json({ draft: updated });
  } catch (e) {
    return routeError(e, { fallbackMessage: "Reject failed", status: 400 });
  }
}
