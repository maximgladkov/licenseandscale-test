"use client";

import { AppPageShell } from "@/components/app-page-shell";
import { CriticBar, formatCheckValue, rubricMeterBounds } from "@/components/critic-rubric";
import { DraftGenerationLog } from "@/components/draft-generation-log";
import { usePageBreadcrumbLabel } from "@/hooks/use-app-breadcrumb";
import {
  useGenerateChatTransport,
  useGenerationDisplayMessages,
} from "@/hooks/use-generation-chat";
import {
  OFFER_SELECT_OPTIONS,
  critiqueVerdictLabel,
  dmDirectionLabel,
  dmIntentLabel,
  dmTemperatureLabel,
  draftStatusLabel,
  rubricCheckLabel,
} from "@/lib/enum-labels";
import {
  extractDraftFromMessage,
  generationLogShouldShow,
  normalizeStoredUIMessages,
} from "@/lib/generation-chat";
import type { GenerationDraftJson } from "@/types/generation-draft-json";
import { tryParsePipelineJson } from "@/lib/pipeline-json";
import { runDeterministicChecks } from "@/lib/rubric";
import type { InboxThreadClientJson } from "@/types/inbox-thread-client-json";
import type { InboxThreadTabKey } from "@/types/inbox-thread-tab-key";
import { useChat } from "@ai-sdk/react";
import {
  Alert,
  Button,
  Card,
  Chip,
  Description,
  Label,
  ListBox,
  Meter,
  Modal,
  Select,
  Tabs,
  Text,
  useOverlayState,
} from "@heroui/react";
import { Channel, DraftStatus, ExemplarKind, Offer } from "@prisma/client";
import type { UIMessage } from "ai";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type InboxThreadDetailClientProps = {
  initialThread: InboxThreadClientJson;
  initialReplyDraft: GenerationDraftJson | null;
};

function dmReplyGenerateChatUserText(topic: string) {
  return `Generate reply\n\nTopic / context:\n${topic}`;
}

export default function InboxThreadDetailClient({
  initialThread,
  initialReplyDraft,
}: InboxThreadDetailClientProps) {
  const router = useRouter();
  const [offer, setOffer] = useState(
    initialReplyDraft?.offer ?? Offer.INNER_CIRCLE,
  );
  const [draft, setDraft] = useState<GenerationDraftJson | null>(
    initialReplyDraft,
  );
  const [error, setError] = useState<string | null>(null);
  const [threadTabKey, setThreadTabKey] = useState<InboxThreadTabKey>("transcript");
  const sendState = useOverlayState();

  const transcript = initialThread.messages
    .map((m) => `${m.direction}: ${m.content}`)
    .join("\n\n");

  usePageBreadcrumbLabel(
    initialThread.senderHandle.trim()
      ? `@${initialThread.senderHandle.trim()}`
      : "Thread",
  );

  useEffect(() => {
    queueMicrotask(() => {
      setDraft(initialReplyDraft);
    });
  }, [
    initialThread.id,
    initialReplyDraft?.id,
    initialReplyDraft?.topic,
    initialReplyDraft?.content,
    initialReplyDraft?.pipelineJson,
    initialReplyDraft?.generationLog,
    initialReplyDraft?.status,
  ]);

  useEffect(() => {
    if (initialReplyDraft?.offer) {
      queueMicrotask(() => {
        setOffer(initialReplyDraft.offer);
      });
    }
  }, [initialReplyDraft?.offer]);

  const transport = useGenerateChatTransport();

  const chatId = `dm-reply-${initialThread.id}`;

  const {
    messages,
    sendMessage,
    status,
    error: chatError,
    setMessages,
  } = useChat({
    id: chatId,
    transport,
    messages: initialReplyDraft?.generationLog ?? [],
    onFinish: ({ message, messages: finishedMessages }) => {
      const d = extractDraftFromMessage(message);
      const mergedLog = normalizeStoredUIMessages(finishedMessages);
      setDraft((prev) => {
        const base = d ?? prev;
        if (!base) return prev;
        return {
          ...base,
          generationLog:
            mergedLog.length > 0 ? mergedLog : base.generationLog,
        };
      });
      if (mergedLog.length > 0 || d != null) {
        router.refresh();
      }
    },
  });

  const genBusy = status === "submitted" || status === "streaming";
  const hasReplyContent = (draft?.content ?? "").trim().length > 0;
  const selectedThreadTabKey: InboxThreadTabKey = genBusy ? "log" : threadTabKey;

  const displayMessages: UIMessage[] = useGenerationDisplayMessages(
    genBusy,
    messages,
    draft?.generationLog ?? [],
  );

  const showLog =
    genBusy ||
    messages.length > 0 ||
    (draft != null && generationLogShouldShow(draft.generationLog));

  function triggerGenerateReply() {
    if (!transcript.trim()) return;
    setError(null);
    setMessages([]);
    setThreadTabKey("log");
    const topic = transcript.trim().slice(0, 12000);
    void sendMessage(
      { text: dmReplyGenerateChatUserText(topic) },
      {
        body: {
          kind: ExemplarKind.DM_REPLY,
          channel: Channel.DM,
          offer,
          topic,
          dmThreadId: initialThread.id,
        },
      },
    );
  }

  const pipeline = draft
    ? tryParsePipelineJson(draft.pipelineJson)
    : null;

  const deterministicRubric = useMemo(() => {
    if (draft == null || !draft.content.trim()) return null;
    return runDeterministicChecks(
      draft.content,
      "DM",
      draft.offer as Offer,
    );
  }, [draft]);

  async function sendReply() {
    if (!draft) return;
    setError(null);
    try {
      const res = await fetch(`/api/drafts/${draft.id}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      setDraft(null);
      sendState.close();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    }
  }

  return (
    <AppPageShell
      title={`@${initialThread.senderHandle}`}
      description="Read the transcript, generate a reply with the pipeline, then approve to send it outbound."
    >
      <Text size="sm" variant="muted">
        {initialThread.messages.length} message(s)
        {" · "}
        {initialThread.isResolved ? "Resolved" : "Open"}
        {initialThread.intent ? ` · ${dmIntentLabel(initialThread.intent)}` : ""}
        {initialThread.temperature
          ? ` · ${dmTemperatureLabel(initialThread.temperature)}`
          : ""}
      </Text>

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
            selectedKey={selectedThreadTabKey}
            onSelectionChange={(key) => {
              const k = key as InboxThreadTabKey;
              if (
                genBusy ||
                (k !== "transcript" && k !== "draft" && k !== "log")
              ) {
                return;
              }
              setThreadTabKey(k);
            }}
          >
            <Tabs.ListContainer className="self-start">
              <Tabs.List aria-label="Inbox thread">
                <Tabs.Tab id="transcript">
                  Transcript
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="draft">
                  Reply
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="log">
                  Log
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>

            <Tabs.Panel id="transcript" className="mt-4 flex flex-col gap-3">
              {initialThread.messages.map((m) => (
                <Card
                  key={m.id}
                  variant={m.direction === "OUTBOUND" ? "secondary" : "default"}
                  className={
                    m.direction === "OUTBOUND"
                      ? "self-end max-w-2/3"
                      : "self-start max-w-2/3"
                  }
                >
                  <Card.Content className="flex flex-col gap-2 whitespace-pre-wrap text-sm">
                    <Description>{dmDirectionLabel(m.direction)}</Description>
                    {m.content}
                  </Card.Content>
                </Card>
              ))}
            </Tabs.Panel>

            <Tabs.Panel id="draft" className="mt-4">
              <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
                <div className="flex min-w-0 flex-[2] flex-col gap-4">
                  <div className="max-w-xs">
                    <Select.Root
                      selectedKey={offer}
                      onSelectionChange={(key) => {
                        if (key != null) setOffer(key as Offer);
                      }}
                    >
                      <Label>Offer framing</Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox.Root>
                          {OFFER_SELECT_OPTIONS.map((opt) => (
                            <ListBox.Item
                              key={opt.value}
                              id={opt.value}
                              textValue={opt.label}
                            >
                              {opt.label}
                            </ListBox.Item>
                          ))}
                        </ListBox.Root>
                      </Select.Popover>
                    </Select.Root>
                  </div>

                  <div>
                    <div className="flex flex-row items-center justify-start gap-2">
                      {draft ? (
                        <Chip
                          variant={
                            draft.status === DraftStatus.PENDING ? "primary" : "secondary"
                          }
                          size="sm"
                        >
                          {draftStatusLabel(draft.status)}
                        </Chip>
                      ) : null}
                    </div>

                    <div className="mt-4 whitespace-pre-wrap leading-relaxed">
                      {hasReplyContent
                        ? draft?.content
                        : genBusy
                          ? "…"
                          : "(No reply yet)"}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="primary"
                      isDisabled={genBusy || !transcript.trim()}
                      onPress={() => triggerGenerateReply()}
                    >
                      {genBusy ? "Generating…" : "Generate reply"}
                    </Button>
                    {!draft || draft.status !== DraftStatus.PENDING || !hasReplyContent
                      ? null
                      : (
                        <Button
                          variant="primary"
                          onPress={() => sendState.open()}
                        >
                          Send (approve + outbound)
                        </Button>
                      )}
                  </div>

                  {!transcript.trim() ? (
                    <Text size="sm" variant="muted">
                      Add at least one inbound message to this thread to generate
                      a reply.
                    </Text>
                  ) : null}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-4">
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
                                <Text size="xs">
                                  {rubricCheckLabel(c.name)}
                                </Text>
                                <span className="flex items-baseline gap-1">
                                  <Meter.Output className="text-xs" />
                                  <Text size="xs" variant="muted">
                                    (threshold{" "}
                                    {formatCheckValue(c.threshold)})
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
                          {critiqueVerdictLabel(pipeline.critique.verdict)} ·
                          revision {pipeline.revisionCount}
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
              </div>
            </Tabs.Panel>

            <Tabs.Panel id="log" className="mt-4 flex flex-col gap-4">
              {showLog ? (
                <DraftGenerationLog
                  messages={displayMessages}
                  awaitingFinalize={genBusy}
                />
              ) : (
                <Text size="sm" variant="muted">
                  Generation log appears after you run generate.
                </Text>
              )}
            </Tabs.Panel>
        </Tabs>
      </div>

      <Modal.Root state={sendState}>
        <Modal.Backdrop>
          <Modal.Container size="md">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>Send reply?</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <Text size="sm" variant="muted">
                  This marks the draft approved, logs an outbound DM, and
                  promotes the reply as a positive exemplar.
                </Text>
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2">
                <Button variant="outline" onPress={() => sendState.close()}>
                  Cancel
                </Button>
                <Button variant="primary" onPress={() => void sendReply()}>
                  Confirm send
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal.Root>
    </AppPageShell>
  );
}
