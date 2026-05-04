"use client";

import { Card, Text } from "@heroui/react";
import {
  JsonTreeView,
  reasoningTextToTreeValue,
  ToolCallDisclosure,
} from "@/components/tool-call-json-view";
import { MarkdownBody } from "@/components/markdown-body";
import type { PipelineDatum } from "@/types/pipeline-datum";
import type { UIMessagePart } from "@/types/ui-message-part";
import type { UIMessage } from "ai";
import { isStaticToolUIPart, isTextUIPart } from "ai";
import type { ReactNode } from "react";

type GenerationMessagePartsProps = {
  messages: UIMessage[];
};

function summarizeJson(value: unknown, max = 900) {
  const s = JSON.stringify(value, null, 2);
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

function isAssistantSubagentOutput(v: unknown): v is UIMessage {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as UIMessage).role === "assistant" &&
    Array.isArray((v as UIMessage).parts)
  );
}

function Spinner() {
  return (
    <span
      className="inline-block size-3 shrink-0 rounded-full border-[1.5px] border-default-400 border-l-foreground animate-spin opacity-70"
      aria-hidden
    />
  );
}

function NestedWriterParts({
  ui,
  prefix,
}: {
  ui: UIMessage;
  prefix: string;
}) {
  return (
    <div className="border-default-300 flex flex-col gap-2 border-l pl-3">
      {(ui.parts ?? []).map((p, idx) => (
        <PartBlock key={`${prefix}-${idx}`} part={p} nestingKey={`${prefix}-${idx}`} />
      ))}
    </div>
  );
}

function PartBlock({
  part,
  nestingKey,
}: {
  part: UIMessagePart;
  nestingKey: string;
}) {
  if (part.type === "step-start") {
    return (
      <div className="border-default-200 border-t pt-2">
        <Text size="xs" variant="muted">
          Step
        </Text>
      </div>
    );
  }

  if (isTextUIPart(part)) {
    if (!part.text.trim()) return null;
    return (
      <div className="max-h-80 overflow-auto rounded-lg bg-slate-100 p-3 dark:bg-slate-900/60">
        <MarkdownBody markdown={part.text} />
      </div>
    );
  }

  if (part.type === "data-pipeline") {
    const d = part.data as PipelineDatum;
    return (
      <Card variant="secondary" className="text-xs">
        <Card.Content className="py-2">
          <Text size="xs" variant="muted">
            {d.status === "start" ? "→" : "✓"} {d.phase}
            {d.detail != null ? `\n${summarizeJson(d.detail, 400)}` : ""}
          </Text>
        </Card.Content>
      </Card>
    );
  }

  if (part.type === "data-draft") {
    const id = (part.data as { draft?: { id: string } }).draft?.id;
    return (
      <Text size="sm" className="text-emerald-600 dark:text-emerald-400">
        Draft saved{id ? ` · ${id}` : ""}
      </Text>
    );
  }

  if (isStaticToolUIPart(part)) {
    const name = part.type.replace(/^tool-/, "");
    const errorText =
      part.state === "output-error" ? part.errorText : undefined;
    const streaming =
      part.state === "output-available" && part.preliminary === true;
    let outputSlot: ReactNode | undefined;
    let passthroughOutput: unknown = part.output;

    if (
      part.type === "tool-writeDraft" &&
      part.state === "output-available" &&
      isAssistantSubagentOutput(part.output)
    ) {
      passthroughOutput = undefined;
      outputSlot = (
        <NestedWriterParts
          ui={part.output}
          prefix={`${nestingKey}-sub`}
        />
      );
    }

    return (
      <Card variant="secondary">
        <Card.Content className="py-2">
          <ToolCallDisclosure
            toolLabel={`Tool: ${name}`}
            titleClassName="text-xs font-semibold"
            input={part.input}
            state={part.state}
            output={passthroughOutput}
            errorText={errorText}
            outputSlot={outputSlot}
            triggerSuffix={streaming ? <Spinner /> : undefined}
          />
        </Card.Content>
      </Card>
    );
  }

  if (part.type === "dynamic-tool") {
    const err =
      part.state === "output-error"
        ? (part as { errorText?: string }).errorText
        : undefined;
    const dg = part as { preliminary?: boolean };
    const streaming =
      part.state === "output-available" && dg.preliminary === true;

    return (
      <Card variant="secondary">
        <Card.Content className="py-2">
          <ToolCallDisclosure
            toolLabel={`Tool: ${part.toolName}`}
            titleClassName="text-xs font-semibold"
            input={part.input}
            state={part.state}
            output={
              part.state === "output-available" ? part.output : undefined
            }
            errorText={err}
            triggerSuffix={streaming ? <Spinner /> : undefined}
          />
        </Card.Content>
      </Card>
    );
  }

  if (part.type === "reasoning") {
    return (
      <div className="flex flex-col gap-1">
        <Text
          size="xs"
          variant="muted"
          className="font-medium uppercase tracking-wide"
        >
          Thought
        </Text>
        <JsonTreeView value={reasoningTextToTreeValue(part.text)} />
      </div>
    );
  }

  return null;
}

export function GenerationMessageParts({
  messages,
}: GenerationMessagePartsProps) {
  if (messages.length === 0) return null;
  return (
    <div className="border-default-200 flex max-h-[min(560px,50vh)] flex-col gap-4 overflow-y-auto rounded-lg border p-3">
      {messages.map((m) => (
        <div key={m.id} className="flex flex-col gap-2">
          <Text size="xs" variant="muted">
            {m.role}
          </Text>
          {m.role === "assistant" ? (
            <div className="flex flex-col gap-2">
              {m.parts.map((part, i) => (
                <PartBlock key={`${m.id}-${i}`} part={part} nestingKey={`${m.id}-${i}`} />
              ))}
            </div>
          ) : (
            m.parts
              .filter(isTextUIPart)
              .map((part, i) => (
                <Text key={i} size="sm">
                  {part.text}
                </Text>
              ))
          )}
        </div>
      ))}
    </div>
  );
}
