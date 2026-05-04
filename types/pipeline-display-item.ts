export type PipelineDisplayItem = {
  kind: "pipeline";
  phase: string;
  running: boolean;
  detail?: unknown;
  key: string;
};
