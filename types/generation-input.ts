import type { Channel, ExemplarKind, Offer } from "@prisma/client";

export type GenerationInput = {
  kind: ExemplarKind;
  channel: Channel;
  offer: Offer;
  topic: string;
  dmThreadId?: string | null;
  draftId?: string | null;
  editorFollowUp?: string | null;
};
