import {
  jsonInvalidQuery,
  readJsonBody,
  routeError,
  zodValidationErrorResponse,
} from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { zChannel, zExemplarKind, zOffer } from "@/lib/validation";
import { NextResponse } from "next/server";
import { z } from "zod";

const CreateBody = z.object({
  kind: zExemplarKind,
  channel: zChannel,
  offer: zOffer,
  topic: z.string().transform((s) => s.trim()).pipe(z.string().min(1)),
});

const Query = z.object({
  kind: zExemplarKind.optional(),
  status: z
    .enum([
      "PENDING",
      "APPROVED",
      "EDITED",
      "REJECTED",
      "SCHEDULED",
      "COMPLETED",
    ])
    .optional(),
});

export async function GET(req: Request) {
  const params = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!params.success) {
    return jsonInvalidQuery();
  }
  try {
    const drafts = await prisma.draft.findMany({
      where: {
        ...(params.data.kind ? { kind: params.data.kind } : {}),
        ...(params.data.status ? { status: params.data.status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ drafts });
  } catch (e) {
    return routeError(e, { fallbackMessage: "Failed to load drafts" });
  }
}

export async function POST(req: Request) {
  const raw = await readJsonBody(req);
  if (!raw.ok) return raw.response;
  const parsed = CreateBody.safeParse(raw.data);
  if (!parsed.success) {
    return zodValidationErrorResponse(parsed.error);
  }
  try {
    const draft = await prisma.draft.create({
      data: {
        ...parsed.data,
        content: "",
        pipelineJson: "",
        status: "PENDING",
      },
    });
    return NextResponse.json({ draft });
  } catch (e) {
    return routeError(e, { fallbackMessage: "Failed to create draft" });
  }
}
