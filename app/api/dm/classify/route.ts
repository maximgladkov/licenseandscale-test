import { routeError } from "@/lib/api-route";
import { classifyDmThread } from "@/lib/dm-classifier";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const Body = z.object({
  threadId: z.string().uuid(),
});

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    await classifyDmThread(body.threadId);
    const thread = await prisma.dmThread.findUniqueOrThrow({
      where: { id: body.threadId },
      include: { messages: true },
    });
    return NextResponse.json({ thread });
  } catch (e) {
    return routeError(e, {
      fallbackMessage: "Classify failed",
      status: 400,
      preferErrorMessage: true,
    });
  }
}
