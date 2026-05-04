import type { ReactNode } from "react";

export type ToolCallJsonPanelsProps = {
  input: unknown;
  state: string;
  output?: unknown;
  errorText?: string;
  outputSlot?: ReactNode;
};
