import type { UIMessagePart } from "@/types/ui-message-part";

export type GenerationLogOtherItem = {
  kind: "other";
  part: UIMessagePart;
  key: string;
};
