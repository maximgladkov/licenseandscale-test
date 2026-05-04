import type { ReactNode } from "react";

export type ToolCallDisclosureProps = {
  toolLabel: string;
  titleClassName?: string;
  input: unknown;
  state: string;
  output?: unknown;
  errorText?: string;
  outputSlot?: ReactNode;
  triggerSuffix?: ReactNode;
};
