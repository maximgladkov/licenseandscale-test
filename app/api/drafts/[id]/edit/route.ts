import { routeError } from "@/lib/api-route";
import { persistExemplar } from "@/lib/exemplars";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const Body = z.object({
  afterText: z.string().min(1),
  changeNote: z.string().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Params) {
  try {
    const { id } = await ctx.params;
    const parsed = Body.parse(await req.json());
    const draft = await prisma.$transaction(async (tx) => {
      const prev = await tx.draft.findUnique({
        where: { id },
      });
      if (!prev || prev.status !== "PENDING") {
        throw new Error("Not pending");
      }
      await tx.edit.create({
        data: {
          draftId: id,
          beforeText: prev.content,
          afterText: parsed.afterText,
          changeNote: parsed.changeNote ?? null,
        },
      });
      return tx.draft.update({
        where: { id },
        data: {
          status: "EDITED",
          content: parsed.afterText,
        },
      });
    });

    await persistExemplar({
      kind: draft.kind,
      channel: draft.channel,
      rating: "POSITIVE",
      content: parsed.afterText,
      sourceDraftId: draft.id,
      reason: parsed.changeNote ?? null,
    });

    const updated = await prisma.draft.findUniqueOrThrow({ where: { id } });
    return NextResponse.json({ draft: updated });
  } catch (e) {
    return routeError(e, { fallbackMessage: "Edit failed", status: 400 });
  }
}
