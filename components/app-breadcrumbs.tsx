"use client";

import { breadcrumbTrailFromPath } from "@/lib/breadcrumb-trail";
import { Breadcrumbs } from "@heroui/react";
import { usePathname } from "next/navigation";
import { useAppBreadcrumb } from "@/hooks/use-app-breadcrumb";

function truncateLabel(text: string, max = 56) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export function AppBreadcrumbs() {
  const pathname = usePathname();
  const { lastLabel } = useAppBreadcrumb();
  const base = breadcrumbTrailFromPath(pathname ?? "");
  const items = base.map((item, i, arr) =>
    i === arr.length - 1 && lastLabel
      ? { ...item, label: truncateLabel(lastLabel) }
      : item,
  );

  if (items.length === 0) return null;

  return (
    <Breadcrumbs aria-label="Breadcrumb" className="shrink-0 [&_li:first-child]:pl-0 mb-2">
      {items.map((item) => (
        <Breadcrumbs.Item key={item.href} href={item.href}>
          {truncateLabel(item.label)}
        </Breadcrumbs.Item>
      ))}
    </Breadcrumbs>
  );
}
