import { openai } from "@ai-sdk/openai";
import { embed } from "ai";
import type { Channel, ExemplarKind, Rating } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import type { ExemplarHit } from "@/types/exemplar-hit";
import type { RawExemplarRow } from "@/types/raw-exemplar-row";
import { openaiEmbeddingModelId } from "./models";
import { prisma } from "./prisma";
import { vectorLiteral } from "./vector";

export async function embedText(value: string) {
  const { embedding } = await embed({
    model: openai.embedding(openaiEmbeddingModelId()),
    value,
  });
  return embedding;
}

function mapRow(r: RawExemplarRow): ExemplarHit {
  return {
    id: r.id,
    content: r.content,
    channel: r.channel,
    reason: r.reason,
    similarity: Number(r.similarity),
  };
}

export async function retrieveExemplars(opts: {
  query: string;
  kind: ExemplarKind;
  channel?: Channel;
  k: number;
}): Promise<{ positive: ExemplarHit[]; negative: ExemplarHit[] }> {
  const embedding = await embedText(opts.query);
  const qv = vectorLiteral(embedding);
  const channelFilter =
    opts.channel !== undefined
      ? Prisma.sql`AND channel = ${opts.channel}::"Channel"`
      : Prisma.empty;

  const [positive, negative] = await Promise.all([
    prisma.$queryRaw<RawExemplarRow[]>`
      SELECT id, content, channel, reason,
             1 - (embedding <=> ${qv}) AS similarity
      FROM "Exemplar"
      WHERE kind = ${opts.kind}::"ExemplarKind"
        AND rating = 'POSITIVE'
        ${channelFilter}
      ORDER BY embedding <=> ${qv}
      LIMIT ${opts.k}
    `,
    prisma.$queryRaw<RawExemplarRow[]>`
      SELECT id, content, channel, reason,
             1 - (embedding <=> ${qv}) AS similarity
      FROM "Exemplar"
      WHERE kind = ${opts.kind}::"ExemplarKind"
        AND rating = 'NEGATIVE'
        ${channelFilter}
      ORDER BY embedding <=> ${qv}
      LIMIT ${opts.k}
    `,
  ]);

  return {
    positive: positive.map(mapRow),
    negative: negative.map(mapRow),
  };
}

export async function persistExemplar(params: {
  kind: ExemplarKind;
  channel: Channel;
  rating: Rating;
  content: string;
  sourceDraftId?: string | null;
  reason?: string | null;
}) {
  const embedding = await embedText(params.content);
  const id = randomUUID();
  const qv = vectorLiteral(embedding);
  await prisma.$executeRaw`
    INSERT INTO "Exemplar" ("id","kind","channel","rating","content","embedding","sourceDraftId","reason")
    VALUES (
      ${id}::uuid,
      ${params.kind}::"ExemplarKind",
      ${params.channel}::"Channel",
      ${params.rating}::"Rating",
      ${params.content},
      ${qv},
      ${params.sourceDraftId ?? null},
      ${params.reason ?? null}
    )
  `;
  return id;
}
