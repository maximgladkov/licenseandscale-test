"use client";

import type { UIMessage } from "ai";
import { DefaultChatTransport } from "ai";
import { useMemo } from "react";

export function useGenerateChatTransport() {
  return useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/generate",
      }),
    [],
  );
}

export function useGenerationDisplayMessages(
  busy: boolean,
  messages: UIMessage[],
  fallbackLog: UIMessage[],
): UIMessage[] {
  return useMemo(() => {
    if (busy || messages.length > 0) return messages;
    return fallbackLog;
  }, [busy, messages, fallbackLog]);
}
