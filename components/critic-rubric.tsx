"use client";

import type { RubricCheck } from "@/types/rubric-check";
import { ProgressBar, Text } from "@heroui/react";

export function formatCheckValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function rubricMeterBounds(c: RubricCheck): {
  minValue: number;
  maxValue: number;
  value: number;
} {
  if (c.name === "hasHook" || c.name === "hasCta") {
    const v = Math.min(1, Math.max(0, c.value));
    return { minValue: 0, maxValue: 1, value: v };
  }
  if (c.name === "corporateJargonCount") {
    const max = Math.max(4, c.value + 1);
    return { minValue: 0, maxValue: max, value: c.value };
  }
  const max = Math.max(c.threshold * 1.25, c.value, c.threshold + 0.01, 1);
  return { minValue: 0, maxValue: max, value: c.value };
}

type CriticBarProps = {
  label: string;
  value: number;
};

export function CriticBar({ label, value }: CriticBarProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between gap-2">
        <Text size="xs" variant="muted">
          {label}
        </Text>
        <Text size="xs" variant="muted">
          {value}/10
        </Text>
      </div>
      <ProgressBar.Root
        value={value}
        minValue={0}
        maxValue={10}
        color="accent"
        size="sm"
        aria-label={`${label} ${value} out of 10`}
      >
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar.Root>
    </div>
  );
}
