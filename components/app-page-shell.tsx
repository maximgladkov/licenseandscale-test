"use client";

import { AppBreadcrumbs } from "@/components/app-breadcrumbs";
import { Description, Text } from "@heroui/react";
import type { ReactNode } from "react";

export type AppPageShellProps = {
  title?: ReactNode;
  render?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  maxWidthClassName?: string;
};

export function AppPageShell({
  title,
  render,
  description,
  actions,
  children,
}: AppPageShellProps) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      <AppBreadcrumbs />

      <div className="flex flex-row flex-wrap items-start justify-between gap-3 gap-y-2">
        <div className="flex flex-col gap-1">
          {title ? (
            <Text size="xl" className="text-3xl font-semibold">
              {title}
            </Text>
          ) : null}
          {description ? <Description className="text-[14px]">{description}</Description> : null}
        </div>

        {actions ? (
          <div className="flex shrink-0 flex-row flex-wrap items-center justify-end gap-2">
            {actions}
          </div>
        ) : null}
      </div>





      {render ? <div className="min-w-0">{render}</div> : null}
      <div
        className="mx-auto flex w-full min-w-0 flex-col gap-4"
      >
        {children}
      </div>
    </div>
  );
}
