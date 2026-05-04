import { routeError } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const Body = z.object({
  scheduledFor: z.string().datetime(),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Params) {
  try {
    const { id } = await ctx.params;
    const { scheduledFor } = Body.parse(await req.json());
    const dt = new Date(scheduledFor);
    const draft = await prisma.draft.update({
      where: { id },
      data: {
        scheduledFor: dt,
        status: "SCHEDULED",
      },
    });
    return NextResponse.json({ draft });
  } catch (e) {
    return routeError(e, { fallbackMessage: "Schedule failed", status: 400 });
  }
}
