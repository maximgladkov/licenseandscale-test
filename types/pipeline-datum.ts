export type PipelineDatum = {
  phase: string;
  status: "start" | "end";
  detail?: unknown;
};
