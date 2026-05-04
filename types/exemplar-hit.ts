import type { Channel } from "@prisma/client";

export type ExemplarHit = {
  id: string;
  content: string;
  channel: Channel;
  reason: string | null;
  similarity: number;
};
