"use client";

import { AppPageShell } from "@/components/app-page-shell";
import { dmIntentLabel, dmTemperatureLabel } from "@/lib/enum-labels";
import {
  Chip,
  EmptyState,
  Table,
  Text,
} from "@heroui/react";
import { fetchJson } from "@/lib/fetch-json";
import type { InboxThreadRow } from "@/types/inbox-thread-row";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";

function inboxThreadStatusChipProps(isResolved: boolean): {
  variant: "primary" | "secondary";
  color?: "success";
} {
  if (isResolved) {
    return { variant: "secondary", color: "success" };
  }
  return { variant: "primary" };
}

export default function InboxListClient() {
  const router = useRouter();
  const [deferThreads, setDeferThreads] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setDeferThreads(true));
  }, []);
  const { data: threads = [], isLoading: threadsLoading } = useSWR(
    deferThreads ? "/api/dm/threads" : null,
    (href) =>
      fetchJson(href, (j) => (j as { threads: InboxThreadRow[] }).threads),
  );
  const loading = !deferThreads || threadsLoading;

  return (
    <AppPageShell
      title="Inbox"
      maxWidthClassName="max-w-full"
      description="DM threads: open one to read the transcript, generate a reply with the pipeline, then approve to send outbound."
    >
      {!loading && threads.length === 0 ? (
        <div className="p-6">
          <EmptyState.Root>
            <Text size="sm" variant="muted">
              No DM threads seeded.
            </Text>
          </EmptyState.Root>
        </div>
      ) : (
        <Table>
          <Table.ScrollContainer className="max-w-full">
            <Table.Content aria-label="DM threads">
              <Table.Header>
                <Table.Column isRowHeader id="sender">
                  Sender
                </Table.Column>
                <Table.Column id="intent">Intent</Table.Column>
                <Table.Column id="temperature">Temperature</Table.Column>
                <Table.Column id="status">Status</Table.Column>
                <Table.Column id="messages">Messages</Table.Column>
              </Table.Header>
              <Table.Body>
                {loading
                  ? null
                  : threads.map((t) => (
                      <Table.Row
                        key={t.id}
                        id={t.id}
                        className="cursor-pointer outline-none transition-colors hover:bg-default-100"
                        onAction={() =>
                          router.push(`/inbox/threads/${t.id}`)
                        }
                      >
                        <Table.Cell>
                          <Text size="sm">@{t.senderHandle}</Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="sm" variant="muted">
                            {t.intent ? dmIntentLabel(t.intent) : "—"}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="sm" variant="muted">
                            {t.temperature
                              ? dmTemperatureLabel(t.temperature)
                              : "—"}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Chip
                            size="sm"
                            {...inboxThreadStatusChipProps(t.isResolved)}
                          >
                            {t.isResolved ? "Resolved" : "Open"}
                          </Chip>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="sm" variant="muted">
                            {t.messages.length}
                          </Text>
                        </Table.Cell>
                      </Table.Row>
                    ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      )}
    </AppPageShell>
  );
}
