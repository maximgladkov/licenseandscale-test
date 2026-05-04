"use client";

import {
  calendarIndicatorsApiUrl,
} from "@/lib/calendar-indicators";
import type { CalendarIndicatorsResponse } from "@/types/calendar-indicators-response";
import { Calendar } from "@heroui/react";
import {
  getLocalTimeZone,
  parseDate,
  today,
  type DateValue,
} from "@internationalized/date";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import useSWR from "swr";

async function indicatorsFetcher(url: string): Promise<CalendarIndicatorsResponse> {
  const r = await fetch(url);
  const data = (await r.json()) as unknown;
  if (!r.ok) {
    const msg =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : `Failed (${r.status})`;
    throw new Error(msg);
  }
  return data as CalendarIndicatorsResponse;
}

export function SidebarCalendar() {
  const router = useRouter();
  const pathname = usePathname();
  const timeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
    [],
  );
  const indicatorsUrl = useMemo(
    () => calendarIndicatorsApiUrl(timeZone),
    [timeZone],
  );

  const { data } = useSWR(indicatorsUrl, indicatorsFetcher, {
    revalidateOnFocus: true,
  });
  const counts = data?.indicators ?? {};

  const selected = useMemo(() => {
    const m = pathname.match(/\/studio\/calendar\/(\d{4}-\d{2}-\d{2})$/);
    if (!m) return null;
    try {
      return parseDate(m[1]);
    } catch {
      return null;
    }
  }, [pathname]);

  const defaultFocused = selected ?? today(getLocalTimeZone());

  return (
    <Calendar
      aria-label="Scheduled posts by day"
      key={pathname}
      value={selected}
      defaultFocusedValue={defaultFocused}
      onChange={(d: DateValue) => {
        router.push(`/studio/calendar/${d.toString()}`);
      }}
    >
      <Calendar.Header>
        <Calendar.NavButton slot="previous" />
        <Calendar.Heading />
        <Calendar.NavButton slot="next" />
      </Calendar.Header>
      <Calendar.Grid>
        <Calendar.GridHeader>
          {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
        </Calendar.GridHeader>
        <Calendar.GridBody>
          {(date) => {
            const ymd = date.toString();
            const n = counts[ymd] ?? 0;
            return (
              <Calendar.Cell date={date}>
                {(slot) => (
                  <>
                    {slot.formattedDate}
                    {n > 0 ? <Calendar.CellIndicator /> : null}
                  </>
                )}
              </Calendar.Cell>
            );
          }}
        </Calendar.GridBody>
      </Calendar.Grid>
    </Calendar>
  );
}
