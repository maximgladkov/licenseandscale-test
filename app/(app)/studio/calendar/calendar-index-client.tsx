"use client";

import { AppPageShell } from "@/components/app-page-shell";
import { Card, Text } from "@heroui/react";

export function CalendarIndexClient() {
  return (
    <AppPageShell
      title="Calendar"
      description="Pick a day in the sidebar calendar to see scheduled posts. Each date has its own URL so you can bookmark or share it. Tip: use Today in the sidebar for the current day."
    >
      <Card>
        <Card.Content className="flex flex-col gap-4">
          <Text size="sm" variant="muted">
            When you select a date, this panel is replaced by the schedule for that day.
          </Text>
        </Card.Content>
      </Card>
    </AppPageShell>
  );
}
