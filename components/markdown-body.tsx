"use client";

import { Md } from "@m2d/react-markdown/client";
import remarkGfm from "remark-gfm";

const proseClassName =
  "prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-headings:my-2 prose-pre:overflow-x-auto prose-pre:text-[12px]";

type MarkdownBodyProps = {
  markdown: string;
  className?: string;
};

export function MarkdownBody({
  markdown,
  className,
}: MarkdownBodyProps) {
  const body = markdown.trim();
  if (!body) return null;
  return (
    <Md
      remarkPlugins={[remarkGfm]}
      skipHtml
      className={[proseClassName, className].filter(Boolean).join(" ")}
    >
      {body}
    </Md>
  );
}
