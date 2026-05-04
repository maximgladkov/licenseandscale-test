import type { UIMessage } from "ai";

export type GenerationDraftJson = {
  id: string;
  kind: string;
  channel: string;
  offer: string;
  topic: string;
  content: string;
  pipelineJson: string;
  generationLog: UIMessage[];
  status: string;
  scheduledFor: string | null;
  dmThreadId: string | null;
  createdAt: string;
};
