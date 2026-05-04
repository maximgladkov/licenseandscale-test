import type { PipelinePayload } from "@/types/pipeline-payload";

export function parsePipelineJson(json: string): PipelinePayload {
  return JSON.parse(json) as PipelinePayload;
}

export function tryParsePipelineJson(json: string): PipelinePayload | null {
  try {
    return parsePipelineJson(json);
  } catch {
    return null;
  }
}
