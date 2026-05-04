import type { GenerationDraftJson } from "@/types/generation-draft-json";
import type { UIMessage } from "ai";
import {
  isStaticToolUIPart,
  isTextUIPart,
} from "ai";
import type { Prisma } from "@prisma/client";

type UIPart = UIMessage["parts"][number];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function normalizeAssistantSubtree(value: unknown, keyBase: string): UIMessage | null {
  if (!isRecord(value)) return null;
  if (value.role !== "assistant") return null;
  const id =
    typeof value.id === "string" && value.id.length > 0
      ? value.id
      : `${keyBase}-nested-assistant`;
  const rawParts = value.parts;
  const partsSrc = Array.isArray(rawParts) ? rawParts : [];
  const parts = partsSrc
    .map((p, i) => normalizePartElement(p, `${id}-${i}`))
    .filter((p): p is UIPart => p != null);
  return {
    id,
    role: "assistant",
    parts,
  };
}

function normalizeToolLikePart(
  part: Record<string, unknown>,
  keyBase: string,
): Record<string, unknown> {
  if (!("output" in part)) return part;
  const out = part.output;
  const normalizedNested = normalizeAssistantSubtree(out, keyBase);
  if (normalizedNested) {
    return { ...part, output: normalizedNested };
  }
  if (Array.isArray(out)) {
    return {
      ...part,
      output: out.map((x, i) => {
        const n = normalizeAssistantSubtree(x, `${keyBase}-o-${i}`);
        return n ?? x;
      }),
    };
  }
  if (out != null && typeof out === "object") {
    return {
      ...part,
      output: normalizeUnknownJson(out, `${keyBase}-out`),
    };
  }
  return part;
}

function normalizeUnknownJson(value: unknown, keyBase: string): unknown {
  if (Array.isArray(value)) {
    return value.map((v, i) => normalizeUnknownJson(v, `${keyBase}-${i}`));
  }
  if (!isRecord(value)) return value;
  if (value.role === "assistant" && "parts" in value) {
    const n = normalizeAssistantSubtree(value, keyBase);
    return n ?? value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [
      k,
      normalizeUnknownJson(v, `${keyBase}-${k}`),
    ]),
  );
}

function normalizePartElement(part: unknown, keyBase: string): UIPart | null {
  if (!isRecord(part)) return null;
  const t = part.type;
  if (typeof t !== "string") return null;
  if (t.startsWith("tool-") || t === "dynamic-tool") {
    return normalizeToolLikePart(part, keyBase) as unknown as UIPart;
  }
  return part as unknown as UIPart;
}

function normalizeOneMessage(item: unknown, index: number): UIMessage | null {
  if (!isRecord(item)) return null;
  const role = item.role;
  if (role !== "system" && role !== "user" && role !== "assistant") {
    return null;
  }
  const id =
    typeof item.id === "string" && item.id.length > 0 ? item.id : `log-msg-${index}`;
  const rawParts = item.parts;
  const partsSrc = Array.isArray(rawParts) ? rawParts : [];
  const parts = partsSrc
    .map((p, i) => normalizePartElement(p, `${id}-${i}`))
    .filter((p): p is UIPart => p != null);
  return {
    id,
    role,
    parts,
    ...(item.metadata !== undefined ? { metadata: item.metadata } : {}),
  };
}

export function normalizeStoredUIMessages(raw: unknown): UIMessage[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return [];
  const out: UIMessage[] = [];
  let i = 0;
  for (const item of raw) {
    const m = normalizeOneMessage(item, i);
    if (m) out.push(m);
    i++;
  }
  return out;
}

export function messageHasRenderableLogContent(m: UIMessage): boolean {
  const parts = m.parts ?? [];
  for (const p of parts) {
    if (p.type === "step-start") continue;
    if (isTextUIPart(p)) {
      if (p.text.trim().length > 0) return true;
      continue;
    }
    if (p.type === "reasoning") {
      const txt = typeof p.text === "string" ? p.text : "";
      if (txt.trim().length > 0) return true;
      continue;
    }
    if (isStaticToolUIPart(p)) return true;
    if (p.type === "dynamic-tool") return true;
    if (
      typeof p.type === "string" &&
      p.type.startsWith("data-") &&
      "data" in p
    ) {
      return true;
    }
  }
  return false;
}

export function generationLogShouldShow(log: unknown): boolean {
  const normalized = normalizeStoredUIMessages(log);
  return normalized.some(messageHasRenderableLogContent);
}

export function parseStoredGenerationLog(raw: unknown): UIMessage[] {
  return normalizeStoredUIMessages(raw);
}

export function serializeGenerationLogForDb(
  messages: UIMessage[],
): Prisma.InputJsonValue {
  const normalized = normalizeStoredUIMessages(messages);
  return JSON.parse(
    JSON.stringify(normalized, (_, v) =>
      typeof v === "bigint" ? v.toString() : v,
    ),
  ) as Prisma.InputJsonValue;
}

export function prismaDraftToClientJson(d: {
  id: string;
  kind: string;
  channel: string;
  offer: string;
  topic: string;
  content: string;
  pipelineJson: string;
  generationLogJson?: unknown | null;
  status: string;
  scheduledFor?: string | Date | null;
  dmThreadId?: string | null;
  createdAt: string | Date;
}): GenerationDraftJson {
  const scheduledFor =
    typeof d.scheduledFor === "string" || d.scheduledFor == null
      ? (d.scheduledFor ?? null)
      : d.scheduledFor.toISOString();
  const createdAt =
    typeof d.createdAt === "string"
      ? d.createdAt
      : d.createdAt.toISOString();
  return {
    id: d.id,
    kind: d.kind,
    channel: d.channel,
    offer: d.offer,
    topic: d.topic,
    content: d.content,
    pipelineJson: d.pipelineJson,
    generationLog: normalizeStoredUIMessages(d.generationLogJson),
    status: d.status,
    scheduledFor,
    dmThreadId: d.dmThreadId ?? null,
    createdAt,
  };
}

export function extractDraftFromMessage(
  message: UIMessage | undefined,
): GenerationDraftJson | null {
  if (!message?.parts) return null;
  let fromDataDraft: GenerationDraftJson | null = null;
  let fromFinalize: GenerationDraftJson | null = null;
  for (const part of message.parts) {
    if (part.type === "data-draft" && "data" in part) {
      const d = part.data as { draft?: GenerationDraftJson };
      if (d.draft) fromDataDraft = d.draft;
    }
    if (
      part.type === "tool-finalizeDraft" &&
      isStaticToolUIPart(part) &&
      part.state === "output-available"
    ) {
      const wrapped = part.output as { draft?: GenerationDraftJson };
      if (wrapped?.draft) fromFinalize = wrapped.draft;
    }
  }
  return fromFinalize ?? fromDataDraft;
}
