"use client";

import { AppPageShell } from "@/components/app-page-shell";
import { CriticBar, formatCheckValue, rubricMeterBounds } from "@/components/critic-rubric";
import { DraftGenerationLog } from "@/components/draft-generation-log";
import { usePageBreadcrumbLabel } from "@/hooks/use-app-breadcrumb";
import {
  useGenerateChatTransport,
  useGenerationDisplayMessages,
} from "@/hooks/use-generation-chat";
import { revalidateScheduledCalendarIndicators } from "@/lib/calendar-indicators";
import { critiqueVerdictLabel, draftStatusLabel, rubricCheckLabel } from "@/lib/enum-labels";
import {
  extractDraftFromMessage,
  generationLogShouldShow,
  normalizeStoredUIMessages,
  prismaDraftToClientJson,
} from "@/lib/generation-chat";
import type { GenerationDraftJson } from "@/types/generation-draft-json";
import { tryParsePipelineJson } from "@/lib/pipeline-json";
import { runDeterministicChecks } from "@/lib/rubric";
import type { DraftDetailTabKey } from "@/types/draft-detail";
import { useChat } from "@ai-sdk/react";
import {
  Alert,
  Button,
  Calendar,
  Card,
  Chip,
  DateField,
  DatePicker,
  Label,
  Meter,
  Modal,
  Tabs,
  Text,
  TextArea,
  TextField,
  useOverlayState,
} from "@heroui/react";
import type { CalendarDateTime } from "@internationalized/date";
import { getLocalTimeZone, now, toCalendarDateTime } from "@internationalized/date";
import { Channel, DraftStatus, Offer } from "@prisma/client";
import type { UIMessage } from "ai";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function draftGenerateChatUserText(topic: string) {
  return `Generate content\n\nTopic / context:\n${topic.trim()}`;
}

type DraftDetailClientProps = {
  initialDraft: GenerationDraftJson;
  initialPendingGenerate: boolean;
};

export default function DraftDetailClient({
  initialDraft,
  initialPendingGenerate,
}: DraftDetailClientProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<GenerationDraftJson>(initialDraft);
  const [error, setError] = useState<string | null>(null);

  const rejectState = useOverlayState();
  const approveScheduleState = useOverlayState();
  const [rejectReason, setRejectReason] = useState("");
  const [followUpText, setFollowUpText] = useState("");
  const [scheduledFor, setScheduledFor] = useState<CalendarDateTime | null>(
    null,
  );

  const [detailTabKey, setDetailTabKey] = useState<DraftDetailTabKey>(() =>
    initialPendingGenerate ? "log" : "draft",
  );

  const autoGenRef = useRef(false);

  useEffect(() => {
    queueMicrotask(() => {
      setDraft(initialDraft);
    });
  }, [
    initialDraft.id,
    initialDraft.topic,
    initialDraft.channel,
    initialDraft.offer,
    initialDraft.content,
    initialDraft.pipelineJson,
    initialDraft.generationLog,
    initialDraft.status,
    initialDraft.scheduledFor,
  ]);

  const pipeline = draft
    ? tryParsePipelineJson(draft.pipelineJson)
    : null;

  usePageBreadcrumbLabel(draft.topic.trim() ? draft.topic.trim() : "Draft");

  const deterministicRubric = useMemo(() => {
    if (!draft.content.trim()) return null;
    return runDeterministicChecks(
      draft.content,
      draft.channel as Channel,
      draft.offer as Offer,
    );
  }, [draft.content, draft.channel, draft.offer]);

  const transport = useGenerateChatTransport();

  const {
    messages,
    sendMessage,
    status,
    error: chatError,
    setMessages,
  } = useChat({
    id: initialDraft.id,
    transport,
    messages: initialDraft.generationLog,
    onFinish: ({ message, messages: finishedMessages }) => {
      const d = extractDraftFromMessage(message);
      const mergedLog = normalizeStoredUIMessages(finishedMessages);
      setDraft((prev) => ({
        ...(d ?? prev),
        generationLog:
          mergedLog.length > 0 ? mergedLog : prev.generationLog,
      }));
      if (mergedLog.length > 0 || d != null) {
        router.refresh();
      }
    },
  });

  useEffect(() => {
    if (!initialPendingGenerate) return;
    if (autoGenRef.current) return;
    autoGenRef.current = true;
    router.replace(`/studio/drafts/${initialDraft.id}`, { scroll: false });
    setError(null);
    setMessages([]);
    setDetailTabKey("log");
    void sendMessage(
      { text: draftGenerateChatUserText(initialDraft.topic) },
      {
        body: {
          kind: initialDraft.kind,
          channel: initialDraft.channel,
          offer: initialDraft.offer,
          topic: initialDraft.topic.trim(),
          draftId: initialDraft.id,
        },
      },
    );
  }, [
    initialPendingGenerate,
    initialDraft.kind,
    initialDraft.channel,
    initialDraft.offer,
    initialDraft.id,
    initialDraft.topic,
    router,
    sendMessage,
    setMessages,
  ]);

  const busy = status === "submitted" || status === "streaming";
  const hasContent = draft.content.trim().length > 0;
  const selectedDetailTabKey: DraftDetailTabKey = busy ? "log" : detailTabKey;

  async function rerunGenerate() {
    setError(null);
    setMessages([]);
    setDetailTabKey("log");
    await sendMessage(
      { text: draftGenerateChatUserText(draft.topic) },
      {
        body: {
          kind: draft.kind,
          channel: draft.channel,
          offer: draft.offer,
          topic: draft.topic.trim(),
          draftId: draft.id,
        },
      },
    );
  }

  async function sendFollowUp() {
    const t = followUpText.trim();
    if (!t || busy || draft.status !== DraftStatus.PENDING || !hasContent) return;
    setError(null);
    setFollowUpText("");
    try {
      await sendMessage(
        { text: t },
        {
          body: {
            kind: draft.kind,
            channel: draft.channel,
            offer: draft.offer,
            topic: draft.topic.trim(),
            draftId: draft.id,
          },
        },
      );
    } catch (e: unknown) {
      setFollowUpText(t);
      setError(e instanceof Error ? e.message : "Follow-up failed");
    }
  }

  const act = useCallback(
    async (path: string, body?: Record<string, unknown>) => {
      const url = path.replace(":id", draft.id);
      const res = await fetch(url, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      const next = prismaDraftToClientJson(
        data.draft as Parameters<typeof prismaDraftToClientJson>[0],
      );
      setDraft(next);
      router.refresh();
    },
    [draft.id, router],
  );

  const displayMessages: UIMessage[] = useGenerationDisplayMessages(
    busy,
    messages,
    draft.generationLog,
  );

  const showLog =
    busy ||
    messages.length > 0 ||
    generationLogShouldShow(draft.generationLog);

  return (
    <AppPageShell
      title={draft.topic.trim() ? draft.topic : "Draft"}
      description="Generate with the pipeline, review on the Draft and Log tabs, then approve and schedule, reject, or send a follow-up prompt to refine."
    >
      {error || chatError ? (
        <Alert.Root status="danger">
          <Alert.Description>
            {error ?? chatError?.message ?? "Generate failed"}
          </Alert.Description>
        </Alert.Root>
      ) : null}

      <div className="w-full flex flex-col gap-4">
        <Tabs
          className="w-full"
          selectedKey={selectedDetailTabKey}
          onSelectionChange={(key) => {
            if (busy || (key !== "draft" && key !== "log")) return;
            setDetailTabKey(key);
          }}
        >
          <Tabs.ListContainer className="self-start w-72">
            <Tabs.List aria-label="Draft detail">
              <Tabs.Tab id="draft">
                Draft
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="log">
                Log
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>

          <Tabs.Panel id="draft" className="mt-4 flex flex-row gap-8">
            <div className="flex-2 flex flex-col gap-8">

              <div className="mt-4 whitespace-pre-wrap leading-relaxed">
                <div className="flex flex-row items-center justify-end gap-2 mb-4">
                  <Chip
                    variant={
                      draft.status === DraftStatus.PENDING ? "primary" : "secondary"
                    }
                    size="sm"
                  >
                    {draftStatusLabel(draft.status)}
                  </Chip>
                </div>

                {hasContent
                  ? draft.content
                  : busy
                    ? "…"
                    : "(No content yet)"}
              </div>

              <div className="flex flex-wrap gap-2">
                {draft.status === DraftStatus.PENDING && hasContent && !busy ? (
                  <>
                    <Button
                      variant="primary"
                      onPress={() => {
                        setScheduledFor(
                          toCalendarDateTime(now(getLocalTimeZone())),
                        );
                        approveScheduleState.open();
                      }}
                    >
                      Approve & schedule
                    </Button>
                    <Button
                      variant="tertiary"
                      onPress={() => {
                        setRejectReason("");
                        rejectState.open();
                      }}
                    >
                      Reject
                    </Button>
                  </>
                ) : null}

                {draft.status === DraftStatus.PENDING && !hasContent && !busy ? (
                  <Button
                    variant="outline"
                    isDisabled={!draft.topic.trim()}
                    onPress={() =>
                      void rerunGenerate().catch((e: unknown) =>
                        setError(
                          e instanceof Error ? e.message : "Generate failed",
                        ),
                      )
                    }
                  >
                    Run generation again
                  </Button>
                ) : null}
              </div>

              {draft.status === DraftStatus.PENDING && hasContent && !busy ? (
                <div className="flex flex-col gap-2">
                  <TextField.Root fullWidth>
                    <Label>Follow-up prompt</Label>
                    <TextArea.Root
                      rows={3}
                      value={followUpText}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setFollowUpText(e.target.value)
                      }
                      placeholder="What should change?"
                    />
                  </TextField.Root>
                  <Button
                    variant="outline"
                    className="self-start"
                    isDisabled={!followUpText.trim()}
                    onPress={() => void sendFollowUp()}
                  >
                    Send follow-up
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="flex-1 flex flex-col gap-4">
              {deterministicRubric ? (
                <Card>
                  <Card.Header className="flex flex-col items-start">
                    <Card.Title>Deterministic rubric</Card.Title>
                    <Card.Description>
                      Score {deterministicRubric.score}/100
                    </Card.Description>
                  </Card.Header>
                  <Card.Content className="mt-3 flex flex-col gap-2">
                    {deterministicRubric.checks.map((c) => {
                      const bounds = rubricMeterBounds(c);
                      return (
                        <Meter
                          key={c.name}
                          className="w-full gap-1"
                          value={bounds.value}
                          minValue={bounds.minValue}
                          maxValue={bounds.maxValue}
                          color={c.pass ? "success" : "danger"}
                          size="sm"
                          formatOptions={{ maximumFractionDigits: 1 }}
                          aria-label={`${rubricCheckLabel(c.name)}: ${formatCheckValue(c.value)}, threshold ${formatCheckValue(c.threshold)}, ${c.pass ? "pass" : "fail"}`}
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <Text size="xs">{rubricCheckLabel(c.name)}</Text>
                            <span className="flex items-baseline gap-1">
                              <Meter.Output className="text-xs" />
                              <Text size="xs" variant="muted">
                                (threshold {formatCheckValue(c.threshold)})
                              </Text>
                            </span>
                          </div>
                          <Meter.Track>
                            <Meter.Fill />
                          </Meter.Track>
                        </Meter>
                      );
                    })}
                  </Card.Content>
                </Card>
              ) : null}

              {pipeline ? (
                <Card>
                  <Card.Header className="flex flex-col items-start">
                    <Card.Title>Critic scores</Card.Title>
                    <Card.Description>
                      {critiqueVerdictLabel(pipeline.critique.verdict)} · revision{" "}
                      {pipeline.revisionCount}
                    </Card.Description>
                  </Card.Header>
                  <Card.Content className="mt-3 flex flex-col gap-3">
                    <CriticBar
                      label="Voice match"
                      value={pipeline.critique.voiceMatch}
                    />
                    <CriticBar
                      label="Hook strength"
                      value={pipeline.critique.hookStrength}
                    />
                    <CriticBar
                      label="Authenticity"
                      value={pipeline.critique.authenticity}
                    />
                    <CriticBar
                      label="CTA fit"
                      value={pipeline.critique.ctaFit}
                    />
                    <div className="flex flex-col gap-1">
                      <Text size="xs" variant="muted">
                        {pipeline.critique.reasons.voiceMatch}
                      </Text>
                      <Text size="xs" variant="muted">
                        {pipeline.critique.reasons.hookStrength}
                      </Text>
                      <Text size="xs" variant="muted">
                        {pipeline.critique.reasons.authenticity}
                      </Text>
                      <Text size="xs" variant="muted">
                        {pipeline.critique.reasons.ctaFit}
                      </Text>
                    </div>
                  </Card.Content>
                </Card>
              ) : null}
            </div>
          </Tabs.Panel>
          <Tabs.Panel id="log" className="mt-4 flex flex-col gap-4">
            {showLog ? (
              <DraftGenerationLog
                messages={displayMessages}
                awaitingFinalize={busy}
              />
            ) : (
              <Text size="sm" variant="muted">
                Generation log appears after you run generate.
              </Text>
            )}
          </Tabs.Panel>
        </Tabs>
      </div>

      <Modal.Root state={rejectState}>
        <Modal.Backdrop>
          <Modal.Container size="md">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>Reject</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="overflow-visible">
                <TextField.Root fullWidth>
                  <Label>Reason (required)</Label>
                  <TextArea.Root
                    placeholder="Reason (required)"
                    value={rejectReason}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setRejectReason(e.target.value)
                    }
                  />
                </TextField.Root>
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2">
                <Button variant="outline" onPress={() => rejectState.close()}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onPress={() => {
                    if (!rejectReason.trim()) return;
                    void act("/api/drafts/:id/reject", {
                      reason: rejectReason,
                    })
                      .then(() => rejectState.close())
                      .catch((e: Error) => setError(e.message));
                  }}
                >
                  Reject draft
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal.Root>

      <Modal.Root state={approveScheduleState}>
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>Approve & schedule</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="overflow-visible">
                <DatePicker
                  className="w-full gap-2"
                  granularity="minute"
                  value={scheduledFor}
                  onChange={(v) => setScheduledFor(v)}
                >
                  <Label>When</Label>
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
                    <Calendar aria-label="Schedule date and time">
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
                  onPress={() => approveScheduleState.close()}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  isDisabled={!scheduledFor}
                  onPress={() => {
                    if (!scheduledFor) return;
                    const iso = scheduledFor
                      .toDate(getLocalTimeZone())
                      .toISOString();
                    void act("/api/drafts/:id/approve", { scheduledFor: iso })
                      .then(() => {
                        void revalidateScheduledCalendarIndicators();
                      })
                      .then(() => approveScheduleState.close())
                      .catch((e: Error) => setError(e.message));
                  }}
                >
                  Approve & schedule
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal.Root>
    </AppPageShell>
  );
}
