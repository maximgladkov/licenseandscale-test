export type StudioDraftListItem = {
  id: string;
  kind: string;
  channel: string;
  offer: string;
  topic: string;
  content: string;
  pipelineJson: string;
  status: string;
  scheduledFor: string | null;
  createdAt: string;
};
