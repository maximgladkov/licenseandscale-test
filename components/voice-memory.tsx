"use client";

import type { ExemplarsStatsResponse } from "@/types/exemplars-stats";
import { Chip, Spinner, Text } from "@heroui/react";
import { useEffect, useState } from "react";

export function VoiceMemory() {
  const [pos, setPos] = useState<number | null>(null);
  const [neg, setNeg] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/exemplars/stats")
      .then((r) => r.json())
      .then((d: ExemplarsStatsResponse) => {
        setPos(d.totals.positive);
        setNeg(d.totals.negative);
      })
      .catch(() => {
        setPos(null);
        setNeg(null);
      });
  }, []);

  if (pos == null || neg == null) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <Spinner size="sm" />
        <Text size="xs" variant="muted">
          Voice memory loading…
        </Text>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1">
      <Text size="xs">Voice memory:</Text>
      <Chip variant="primary" size="sm">
        {pos} positive
      </Chip>
      <Chip variant="tertiary" size="sm">
        {neg} negative
      </Chip>
    </div>
  );
}
