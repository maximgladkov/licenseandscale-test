import { prismaClientErrorMessage } from "@/lib/prisma-http";
import {
  streamDraftGeneration,
  streamDraftRefinement,
} from "@/lib/agents/draft-generation-agent";
import {
  readJsonBody,
  zodValidationErrorResponse,
} from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { serializeGenerationLogForDb } from "@/lib/generation-chat";
import { zChannel, zExemplarKind, zOffer } from "@/lib/validation";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  isTextUIPart,
} from "ai";
import type { UIMessage } from "ai";
import { z } from "zod";

const ChatRequestSchema = z.object({
  id: z.string().optional(),
  messages: z.array(z.unknown()),
  trigger: z.string().optional(),
  messageId: z.string().nullable().optional(),
  kind: zExemplarKind,
  channel: zChannel,
  offer: zOffer,
  topic: z.string().transform((s) => s.trim()).pipe(z.string().min(1)),
  dmThreadId: z.string().uuid().optional(),
  draftId: z.string().uuid().optional(),
});

function countUserMessages(messages: UIMessage[]): number {
  return messages.filter((m) => m.role === "user").length;
}

function lastUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    const parts = m.parts ?? [];
    const lines: string[] = [];
    for (const p of parts) {
      if (isTextUIPart(p) && p.text.trim()) lines.push(p.text.trim());
    }
    const t = lines.join("\n\n");
    if (t) return t;
  }
  return "";
}

export async function POST(req: Request) {
  const raw = await readJsonBody(req);
  if (!raw.ok) return raw.response;
  const parsed = ChatRequestSchema.safeParse(raw.data);
  if (!parsed.success) {
    return zodValidationErrorResponse(parsed.error);
  }
  const { messages, ...genInput } = parsed.data;
  const uiMessages = messages as UIMessage[];

  let persistedDraftIdForLog: string | null = null;

  const stream = createUIMessageStream({
    originalMessages: uiMessages,
    execute: async ({ writer }) => {
      persistedDraftIdForLog = null;
      try {
        const baseInput = {
          kind: genInput.kind,
          channel: genInput.channel,
          offer: genInput.offer,
          topic: genInput.topic,
          dmThreadId: genInput.dmThreadId ?? null,
          draftId: genInput.draftId ?? null,
        };

        let draft;

        if (genInput.draftId) {
          const row = await prisma.draft.findUnique({
            where: { id: genInput.draftId },
          });
          if (
            row &&
            row.status === "PENDING" &&
            row.content.trim() &&
            countUserMessages(uiMessages) >= 2
          ) {
            const followUp = lastUserText(uiMessages);
            if (followUp.trim()) {
              draft = await streamDraftRefinement(writer, {
                ...baseInput,
                editorFollowUp: followUp,
              });
            } else {
              throw new Error("Follow-up message is empty");
            }
          }
        }

        if (!draft) {
          draft = await streamDraftGeneration(writer, baseInput);
        }

        persistedDraftIdForLog = draft.id;
      } catch (err) {
        const pm = prismaClientErrorMessage(err);
        throw new Error(
          pm ?? (err instanceof Error ? err.message : "Generation failed"),
        );
      }
    },
    onFinish: async ({ isAborted, messages: finishedMessages }) => {
      if (isAborted || !persistedDraftIdForLog) return;
      try {
        const json = serializeGenerationLogForDb(finishedMessages);
        await prisma.draft.update({
          where: { id: persistedDraftIdForLog },
          data: { generationLogJson: json },
        });
      } catch (e) {
        console.error(e);
      }
    },
  });
  return createUIMessageStreamResponse({ stream });
}
