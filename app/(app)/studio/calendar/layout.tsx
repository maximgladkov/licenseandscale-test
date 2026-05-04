import { Text } from "@heroui/react";
import type { ReactNode } from "react";

export default function StudioCalendarLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <Text size="xl">Calendar</Text>
      {children}
    </div>
  );
}
