"use client";

import { AppPageShell } from "@/components/app-page-shell";
import {
  CHANNEL_SELECT_OPTIONS,
  OFFER_SELECT_OPTIONS,
  channelLabel,
  draftStatusLabel,
  offerLabel,
} from "@/lib/enum-labels";
import {
  Alert,
  Button,
  Chip,
  EmptyState,
  Label,
  ListBox,
  Modal,
  Select,
  Table,
  Text,
  TextArea,
  TextField,
  useOverlayState
} from "@heroui/react";
import { fetchJson } from "@/lib/fetch-json";
import type { StudioDraftListItem } from "@/types/studio-draft-list";
import { Channel, DraftStatus, ExemplarKind, Offer } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";

function draftStatusChipProps(status: string): {
  variant: "primary" | "secondary" | "soft" | "tertiary";
  color?: "accent" | "danger" | "default" | "success" | "warning";
} {
  switch (status) {
    case DraftStatus.PENDING:
      return { variant: "primary" };
    case DraftStatus.APPROVED:
      return { variant: "secondary", color: "success" };
    case DraftStatus.EDITED:
      return { variant: "tertiary" };
    case DraftStatus.REJECTED:
      return { variant: "soft", color: "danger" };
    case DraftStatus.SCHEDULED:
      return { variant: "secondary", color: "accent" };
    case DraftStatus.COMPLETED:
      return { variant: "soft", color: "success" };
    default:
      return { variant: "tertiary", color: "default" };
  }
}

export default function StudioListClient() {
  const router = useRouter();
  const { data: drafts = [], isLoading: loading } = useSWR(
    `/api/drafts?kind=${ExemplarKind.CONTENT_POST}`,
    (href) =>
      fetchJson(href, (j) => (j as { drafts: StudioDraftListItem[] }).drafts),
  );
  const createState = useOverlayState();
  const [channel, setChannel] = useState<Channel>(Channel.IG_CAPTION);
  const [offer, setOffer] = useState<Offer>(Offer.INNER_CIRCLE);
  const [topic, setTopic] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  async function createDraftAndGo() {
    setCreateErr(null);
    setCreateBusy(true);
    try {
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: ExemplarKind.CONTENT_POST,
          channel,
          offer,
          topic: topic.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not create draft");
      setCreateBusy(false);
      createState.close();
      setTopic("");
      router.push(`/studio/drafts/${data.draft.id}?generate=1`);
    } catch (e) {
      setCreateBusy(false);
      setCreateErr(e instanceof Error ? e.message : "Could not create draft");
    }
  }

  function openModal() {
    setCreateErr(null);
    setCreateBusy(false);
    createState.open();
  }

  return (
    <AppPageShell
      title="Studio"
      maxWidthClassName="max-w-full"
      description="Create drafts, run the pipeline, then approve and schedule, reject, or refine with a follow-up prompt."
      actions={
        <Button variant="primary" onPress={openModal}>
          New draft
        </Button>
      }
    >
      {!loading && drafts.length === 0 ? (
        <div className="p-6">
          <EmptyState.Root>
            <Text size="sm" variant="muted">
              No drafts yet. Create one to get started.
            </Text>
          </EmptyState.Root>
        </div>
      ) : (
        <Table>
          <Table.ScrollContainer className="max-w-full">
            <Table.Content aria-label="Content drafts">
              <Table.Header>
                <Table.Column isRowHeader id="topic">
                  Topic
                </Table.Column>
                <Table.Column id="channel">Channel</Table.Column>
                <Table.Column id="offer">Offer</Table.Column>
                <Table.Column id="status">Status</Table.Column>
                <Table.Column id="created">Created</Table.Column>
              </Table.Header>
              <Table.Body>
                {loading
                  ? null
                  : drafts.map((d) => (
                      <Table.Row
                        key={d.id}
                        id={d.id}
                        className="cursor-pointer outline-none transition-colors hover:bg-default-100"
                        onAction={() =>
                          router.push(`/studio/drafts/${d.id}`)
                        }
                      >
                        <Table.Cell>
                          <Text size="sm" className="line-clamp-2 max-w-[18rem]">
                            {d.topic || "—"}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="sm" variant="muted">
                            {channelLabel(d.channel)}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="sm" variant="muted">
                            {offerLabel(d.offer)}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Chip size="sm" {...draftStatusChipProps(d.status)}>
                            {draftStatusLabel(d.status)}
                          </Chip>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="sm" variant="muted">
                            {d.createdAt.slice(0, 10)}
                          </Text>
                        </Table.Cell>
                      </Table.Row>
                    ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      )}

      <Modal.Root state={createState}>
        <Modal.Backdrop>
          <Modal.Container size="lg">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>New draft</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-3 overflow-visible">
                <Select
                  selectedKey={channel}
                  onSelectionChange={(key) => {
                    if (key != null) setChannel(key as Channel);
                  }}
                >
                  <Label>Channel</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox.Root>
                      {CHANNEL_SELECT_OPTIONS.map((opt) => (
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
                </Select>

                <Select
                  selectedKey={offer}
                  onSelectionChange={(key) => {
                    if (key != null) setOffer(key as Offer);
                  }}
                >
                  <Label>Offer</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {OFFER_SELECT_OPTIONS.map((opt) => (
                        <ListBox.Item
                          key={opt.value}
                          id={opt.value}
                          textValue={opt.label}
                        >
                          {opt.label}
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>

                {createErr ? (
                  <Alert.Root status="danger">
                    <Alert.Description>{createErr}</Alert.Description>
                  </Alert.Root>
                ) : null}

                <TextField.Root fullWidth>
                  <Label>Topic</Label>
                  <TextArea.Root
                    rows={4}
                    placeholder="What should Maya talk about?"
                    value={topic}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setTopic(e.target.value)
                    }
                  />
                </TextField.Root>
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2">
                <Button variant="outline" onPress={() => createState.close()}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  isDisabled={createBusy || !topic.trim()}
                  onPress={() => void createDraftAndGo()}
                >
                  {createBusy ? "Creating…" : "Create and generate"}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal.Root>
    </AppPageShell>
  );
}
