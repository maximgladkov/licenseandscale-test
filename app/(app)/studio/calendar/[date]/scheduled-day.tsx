"use client";

import { AppPageShell } from "@/components/app-page-shell";
import { revalidateScheduledCalendarIndicators } from "@/lib/calendar-indicators";
import { channelLabel } from "@/lib/enum-labels";
import type { CalendarDateTime } from "@internationalized/date";
import {
  fromDate,
  getLocalTimeZone,
  now,
  toCalendarDateTime,
} from "@internationalized/date";
import Check from "@gravity-ui/icons/Check";
import Copy from "@gravity-ui/icons/Copy";
import {
  Alert,
  Button,
  Calendar,
  Card,
  DateField,
  DatePicker,
  Label,
  Modal,
  Spinner,
  Text,
  toast,
  useOverlayState,
} from "@heroui/react";
import { fetchJson } from "@/lib/fetch-json";
import type { CalendarScheduledDraftSummary } from "@/types/calendar-scheduled-draft";
import { DraftStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";

function matchesLocalDay(iso: string, ymd: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}` === ymd;
}

type ScheduledPostCardProps = {
  draft: CalendarScheduledDraftSummary;
  onRefresh: () => void;
};

function ScheduledPostCard({
  draft,
  onRefresh,
}: ScheduledPostCardProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [completing, setCompleting] = useState(false);
  const [rescheduleBusy, setRescheduleBusy] = useState(false);
  const rescheduleState = useOverlayState();
  const [rescheduleAt, setRescheduleAt] = useState<CalendarDateTime | null>(
    null,
  );

  useEffect(() => {
    return () => {
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
    };
  }, []);

  async function copyContent() {
    try {
      await navigator.clipboard.writeText(draft.content);
      setCopied(true);
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
      copyResetRef.current = setTimeout(() => {
        setCopied(false);
        copyResetRef.current = null;
      }, 2000);
      toast.success("Copied to clipboard");
    } catch {
      toast.danger("Could not copy");
    }
  }

  async function markCompleted() {
    setCompleting(true);
    try {
      const r = await fetch(`/api/drafts/${draft.id}/complete`, {
        method: "POST",
      });
      const data = (await r.json()) as unknown;
      if (!r.ok) {
        const msg =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : `Request failed (${r.status})`;
        throw new Error(msg);
      }
      toast.success("Marked as completed");
      await revalidateScheduledCalendarIndicators();
      onRefresh();
    } catch (e) {
      toast.danger(e instanceof Error ? e.message : "Could not complete");
    } finally {
      setCompleting(false);
    }
  }

  function openReschedule() {
    const iso = draft.scheduledFor;
    if (iso) {
      setRescheduleAt(
        toCalendarDateTime(fromDate(new Date(iso), getLocalTimeZone())),
      );
    } else {
      setRescheduleAt(toCalendarDateTime(now(getLocalTimeZone())));
    }
    rescheduleState.open();
  }

  async function submitReschedule() {
    if (!rescheduleAt) return;
    setRescheduleBusy(true);
    try {
      const scheduledFor = rescheduleAt
        .toDate(getLocalTimeZone())
        .toISOString();
      const r = await fetch(`/api/drafts/${draft.id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledFor }),
      });
      const data = (await r.json()) as unknown;
      if (!r.ok) {
        const msg =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : `Request failed (${r.status})`;
        throw new Error(msg);
      }
      toast.success("Rescheduled");
      await revalidateScheduledCalendarIndicators();
      rescheduleState.close();
      onRefresh();
    } catch (e) {
      toast.danger(e instanceof Error ? e.message : "Could not reschedule");
    } finally {
      setRescheduleBusy(false);
    }
  }

  return (
    <>
      <Card>
        <Card.Header className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col items-start">
            <Card.Title>{draft.topic}</Card.Title>
            <Card.Description>{channelLabel(draft.channel)}</Card.Description>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onPress={() => void copyContent()}
              aria-label={copied ? "Copied" : "Copy content"}
            >
              {copied ? (
                <Check className="size-4 text-emerald-600" aria-hidden />
              ) : (
                <Copy className="size-4" aria-hidden />
              )}
              <span className="sr-only sm:not-sr-only sm:ml-1">
                {copied ? "Copied" : "Copy"}
              </span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              isDisabled={completing}
              onPress={() => void markCompleted()}
            >
              {completing ? <Spinner size="sm" /> : null}
              Mark completed
            </Button>
            <Button
              variant="secondary"
              size="sm"
              isDisabled={rescheduleBusy}
              onPress={openReschedule}
            >
              Reschedule
            </Button>
            <Button
              variant="tertiary"
              size="sm"
              onPress={() => router.push(`/studio/drafts/${draft.id}`)}
            >
              Open in Studio
            </Button>
          </div>
        </Card.Header>
        <Card.Content className="mt-2 whitespace-pre-wrap text-sm">
          {draft.content}
        </Card.Content>
      </Card>

      <Modal.Root state={rescheduleState}>
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>Reschedule</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="overflow-visible">
                <DatePicker
                  className="w-full gap-2"
                  granularity="minute"
                  value={rescheduleAt}
                  onChange={(v) => setRescheduleAt(v)}
                >
                  <Label>New time</Label>
                  <DateField.Group fullWidth variant="secondary">
                    <DateField.Input>
                      {(segment) => <DateField.Segment segment={segment} />}
                    </DateField.Input>
                    <DateField.Suffix>
                      <DatePicker.Trigger>
                        <DatePicker.TriggerIndicator />
                      </DatePicker.Trigger>
                    </DateField.Suffix>
                  </DateField.Group>
                  <DatePicker.Popover>
                    <Calendar aria-label="Pick date and time">
                      <Calendar.Header>
                        <Calendar.YearPickerTrigger>
                          <Calendar.YearPickerTriggerHeading />
                          <Calendar.YearPickerTriggerIndicator />
                        </Calendar.YearPickerTrigger>
                        <Calendar.NavButton slot="previous" />
                        <Calendar.NavButton slot="next" />
                      </Calendar.Header>
                      <Calendar.Grid>
                        <Calendar.GridHeader>
                          {(day) => (
                            <Calendar.HeaderCell>{day}</Calendar.HeaderCell>
                          )}
                        </Calendar.GridHeader>
                        <Calendar.GridBody>
                          {(date) => <Calendar.Cell date={date} />}
                        </Calendar.GridBody>
                      </Calendar.Grid>
                    </Calendar>
                  </DatePicker.Popover>
                </DatePicker>
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onPress={() => rescheduleState.close()}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  isDisabled={!rescheduleAt || rescheduleBusy}
                  onPress={() => void submitReschedule()}
                >
                  {rescheduleBusy ? <Spinner size="sm" /> : null}
                  Save
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal.Root>
    </>
  );
}

export function ScheduledDay({ date }: { date: string }) {
  const [deferDrafts, setDeferDrafts] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setDeferDrafts(true));
  }, []);
  const {
    data: drafts = [],
    error: swrError,
    isLoading: draftsLoading,
    mutate: loadDrafts,
  } = useSWR(
    deferDrafts ? `/api/drafts?status=${DraftStatus.SCHEDULED}` : null,
    (href) =>
      fetchJson(
        href,
        (j) =>
          (j as { drafts?: CalendarScheduledDraftSummary[] }).drafts ?? [],
      ),
  );
  const loading = !deferDrafts || draftsLoading;
  const error =
    swrError instanceof Error
      ? swrError.message
      : swrError
        ? "Request failed"
        : null;

  const forDay = useMemo(
    () =>
      drafts.filter(
        (dr) => dr.scheduledFor && matchesLocalDay(dr.scheduledFor, date),
      ),
    [drafts, date],
  );

  const pretty = useMemo(() => {
    const parts = date.split("-").map(Number);
    const y = parts[0];
    const m = parts[1];
    const day = parts[2];
    if (y === undefined || m === undefined || day === undefined) return date;
    return new Date(y, m - 1, day).toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, [date]);

  if (loading) {
    return (
      <AppPageShell
        description="Posts scheduled for this calendar day in your local timezone. Open a card to edit the draft in Studio."
        title={pretty}
      >
        <div className="flex items-center gap-2">
          <Spinner size="sm" />
          <Text size="sm" variant="muted">
            Loading…
          </Text>
        </div>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell
      title={pretty}
      description="Posts scheduled for this calendar day in your local timezone. Open a card to edit the draft in Studio."
    >
      <div className="flex flex-col gap-4">
        {error ? (
          <Alert.Root status="warning">
            <Alert.Description>{error}</Alert.Description>
          </Alert.Root>
        ) : null}
        <div className="flex flex-col gap-1">
          <Text size="sm" variant="muted">
            {forDay.length === 0
              ? "No posts scheduled for this day."
              : `${forDay.length} scheduled draft${forDay.length === 1 ? "" : "s"}.`}
          </Text>
        </div>
        <div className="flex flex-col gap-3">
          {forDay.map((d) => (
            <ScheduledPostCard
              key={d.id}
              draft={d}
              onRefresh={loadDrafts}
            />
          ))}
        </div>
      </div>
    </AppPageShell>
  );
}
