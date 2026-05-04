"use client";

import { mutate } from "swr";

export function calendarIndicatorsApiUrl(timeZone: string): string {
  const tz = encodeURIComponent(timeZone);
  return `/api/drafts/calendar-indicators?tz=${tz}`;
}

export function revalidateScheduledCalendarIndicators() {
  return mutate(calendarIndicatorsKeyMatcher);
}

export function calendarIndicatorsKeyMatcher(key: unknown): boolean {
  return typeof key === "string" && key.includes("/api/drafts/calendar-indicators?");
}
