"use client";

import { Button, Disclosure } from "@heroui/react";
import JsonView from "@uiw/react-json-view";
import { darkTheme } from "@uiw/react-json-view/dark";
import { lightTheme } from "@uiw/react-json-view/light";
import { useEffect, useRef, useState } from "react";
import type { JsonTreeViewProps } from "@/types/json-tree-view-props";
import type { ToolCallDisclosureProps } from "@/types/tool-call-disclosure-props";
import type { ToolCallJsonPanelsProps } from "@/types/tool-call-json-panels-props";

function toJsonTreeValue(data: unknown): object {
  if (data !== null && typeof data === "object") {
    return data as object;
  }
  if (data === undefined) {
    return {};
  }
  return { value: data };
}

export function reasoningTextToTreeValue(text: string): object {
  const t = text.trim();
  if (!t.length) {
    return {};
  }
  if (
    (t.startsWith("{") && t.endsWith("}")) ||
    (t.startsWith("[") && t.endsWith("]"))
  ) {
    try {
      const parsed: unknown = JSON.parse(t);
      if (parsed !== null && typeof parsed === "object") {
        return parsed as object;
      }
      return { value: parsed };
    } catch {
      return { text };
    }
  }
  return { text };
}

export function JsonTreeView({ value }: JsonTreeViewProps) {
  const tree = toJsonTreeValue(value);
  return (
    <div className="max-h-64 overflow-auto rounded-md border border-slate-200 bg-white text-[11px] dark:border-white/10 dark:bg-slate-950/40">
      <div className="block dark:hidden">
        <div className="p-2">
          <JsonView
            value={tree}
            style={lightTheme}
            collapsed={1}
            displayObjectSize={false}
            displayDataTypes={false}
            shortenTextAfterLength={96}
          />
        </div>
      </div>
      <div className="hidden dark:block">
        <div className="p-2">
          <JsonView
            value={tree}
            style={darkTheme}
            collapsed={1}
            displayObjectSize={false}
            displayDataTypes={false}
            shortenTextAfterLength={96}
          />
        </div>
      </div>
    </div>
  );
}

export function ToolCallJsonPanels({
  input,
  state,
  output,
  errorText,
  outputSlot,
}: ToolCallJsonPanelsProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">
          Input
        </div>
        <JsonTreeView value={input} />
      </div>
      {state === "output-available" && (outputSlot != null || output !== undefined) ? (
        <div className="flex flex-col gap-1">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">
            Output
          </div>
          {outputSlot ?? <JsonTreeView value={output} />}
        </div>
      ) : null}
      {state === "output-error" ? (
        <div className="flex flex-col gap-1">
          <div className="text-[11px] font-medium uppercase tracking-wide text-red-700 dark:text-red-400">
            Error
          </div>
          <JsonTreeView value={{ message: errorText ?? "Unknown error" }} />
        </div>
      ) : null}
    </div>
  );
}

function toolInvocationIsDone(toolState: string) {
  return (
    toolState === "output-available" || toolState === "output-error"
  );
}

export function ToolCallDisclosure({
  toolLabel,
  titleClassName,
  input,
  state,
  output,
  errorText,
  outputSlot,
  triggerSuffix,
}: ToolCallDisclosureProps) {
  const done = toolInvocationIsDone(state);
  const [expanded, setExpanded] = useState(() => !done);
  const prevDoneRef = useRef(done);

  useEffect(() => {
    const wasDone = prevDoneRef.current;
    prevDoneRef.current = done;
    if (!wasDone && done) {
      setExpanded(false);
    }
  }, [done]);

  return (
    <Disclosure
      isExpanded={expanded}
      onExpandedChange={setExpanded}
      className="my-1"
    >
      <Disclosure.Heading>
        <Disclosure.Trigger>
          <Button slot="trigger" variant="tertiary" size="sm" className="text-xs px-2 h-6">
            {toolLabel}
            <Disclosure.Indicator className="size-3" />
          </Button>
        </Disclosure.Trigger>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body className="pb-1 pt-2">
          <ToolCallJsonPanels
            input={input}
            state={state}
            output={output}
            errorText={errorText}
            outputSlot={outputSlot}
          />
        </Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
}
