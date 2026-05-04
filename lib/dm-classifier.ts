import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import type { DmIntent, DmTemperature } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { anthropicModelId } from "@/lib/models";

const ClassifySchema = z.object({
  intent: z.enum([
    "PURCHASE_READY",
    "PRODUCT_QUALITY",
    "PRICE_SHOPPER",
    "GENERAL_QUESTION",
    "NOT_A_FIT",
    "SPAM",
    "OBJECTION",
  ]),
  temperature: z.enum(["HOT", "WARM", "COLD"]),
});

export async function classifyDmThread(threadId: string): Promise<{
  intent: DmIntent;
  temperature: DmTemperature;
}> {
  const messages = await prisma.dmMessage.findMany({
    where: { threadId, direction: "INBOUND" },
    orderBy: { id: "asc" },
  });
  const transcript = messages.map((m) => m.content).join("\n---\n");
  const { object } = await generateObject({
    model: anthropic(anthropicModelId()),
    schema: ClassifySchema,
    system:
      "You label inbound DMs for a B2B sales coach (Maya). Pick one intent and one temperature. " +
      "PURCHASE_READY: ready to buy or join Inner Circle now. PRICE_SHOPPER: cheapest/discount framing. " +
      "PRODUCT_QUALITY: compares offers or wonders if accelerator/course fits. GENERAL_QUESTION: generic learning question. " +
      "OBJECTION: skeptical or stalled. NOT_A_FIT: wrong niche. SPAM: cold pitch or nonsense. " +
      "Temperature: HOT urgency, WARM exploratory, COLD low intent.",
    prompt: `Latest inbound thread (may be multi-message):\n${transcript}`,
  });
  await prisma.dmThread.update({
    where: { id: threadId },
    data: { intent: object.intent, temperature: object.temperature },
  });
  return object;
}
