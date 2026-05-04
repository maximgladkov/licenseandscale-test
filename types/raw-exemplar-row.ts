import type { Channel } from "@prisma/client";

export type RawExemplarRow = {
  id: string;
  content: string;
  channel: Channel;
  reason: string | null;
  similarity: unknown;
};
