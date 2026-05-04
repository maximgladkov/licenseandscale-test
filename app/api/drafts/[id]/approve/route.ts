import { HttpError, routeError } from "@/lib/api-route";
import { persistExemplar } from "@/lib/exemplars";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

const Body = z.object({
  scheduledFor: z.string().datetime().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Params) {
  try {
    const { id } = await ctx.params;
    let body: z.infer<typeof Body>;
    try {
      const text = await req.text();
      body = text.trim() ? Body.parse(JSON.parse(text)) : {};
    } catch (e) {
      if (e instanceof ZodError) throw e;
      throw new HttpError("Invalid body", 400);
    }

    const draft = await prisma.$transaction(async (tx) => {
      const found = await tx.draft.findUnique({ where: { id } });
      if (!found) throw new Error("Draft not found");
      if (found.status !== "PENDING") throw new Error("Draft is not pending");

      if (found.kind === "CONTENT_POST" && !body.scheduledFor) {
        throw new HttpError("scheduledFor is required for content posts", 400);
      }

      const data =
        found.kind === "DM_REPLY"
          ? { status: "APPROVED" as const }
          : {
              status: "SCHEDULED" as const,
              scheduledFor: new Date(body.scheduledFor!),
            };

      const updated = await tx.draft.update({
        where: { id, status: "PENDING" },
        data,
      });

      if (updated.kind === "DM_REPLY" && updated.dmThreadId) {
        await tx.dmMessage.create({
          data: {
            threadId: updated.dmThreadId,
            direction: "OUTBOUND",
            content: updated.content,
            draftId: updated.id,
          },
        });
      }
      return updated;
    });

    await persistExemplar({
      kind: draft.kind,
      channel: draft.channel,
      rating: "POSITIVE",
      content: draft.content,
      sourceDraftId: draft.id,
    });

    const updated = await prisma.draft.findUniqueOrThrow({ where: { id } });
    return NextResponse.json({ draft: updated });
  } catch (e) {
    return routeError(e, { fallbackMessage: "Approve failed", status: 400 });
  }
}
