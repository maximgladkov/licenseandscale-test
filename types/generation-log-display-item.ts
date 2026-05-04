import type { GenerationLogOtherItem } from "@/types/generation-log-other-item";
import type { PipelineDisplayItem } from "@/types/pipeline-display-item";

export type GenerationLogDisplayItem =
  | PipelineDisplayItem
  | GenerationLogOtherItem;
