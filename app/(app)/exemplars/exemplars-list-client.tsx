"use client";

import { AppPageShell } from "@/components/app-page-shell";
import {
  channelLabel,
  exemplarKindLabel,
  ratingLabel,
} from "@/lib/enum-labels";
import { EmptyState, Kbd, Table, Text } from "@heroui/react";
import { fetchJson } from "@/lib/fetch-json";
import type { ExemplarClientJson } from "@/types/exemplar";
import useSWR from "swr";
import type { Channel, ExemplarKind, Rating } from "@prisma/client";
import { useRouter } from "next/navigation";

export default function ExemplarsListClient() {
  const router = useRouter();
  const { data: exemplars = [], isLoading: loading } = useSWR(
    "/api/exemplars",
    (href) =>
      fetchJson(href, (j) =>
        (j as { exemplars?: ExemplarClientJson[] }).exemplars ?? [],
      ),
  );

  return (
    <AppPageShell
      title="Exemplars"
      maxWidthClassName="max-w-full"
      description="Read-only voice memory entries used for retrieval (pgvector). Open a row for full text, reason, and source draft."
    >
      {!loading && exemplars.length === 0 ? (
        <div className="p-6">
          <EmptyState.Root>
            <Text size="sm" variant="muted">
              No exemplars yet. Seed the database (<Kbd.Root>npm run db:seed</Kbd.Root>).
            </Text>
          </EmptyState.Root>
        </div>
      ) : (
        <Table>
          <Table.ScrollContainer className="max-w-full">
            <Table.Content aria-label="Exemplars">
              <Table.Header>
                <Table.Column isRowHeader id="preview">
                  Preview
                </Table.Column>
                <Table.Column id="kind">Kind</Table.Column>
                <Table.Column id="channel">Channel</Table.Column>
                <Table.Column id="rating">Rating</Table.Column>
                <Table.Column id="created">Created</Table.Column>
              </Table.Header>
              <Table.Body>
                {loading
                  ? null
                  : exemplars.map((e) => (
                      <Table.Row
                        key={e.id}
                        id={e.id}
                        className="cursor-pointer outline-none transition-colors hover:bg-default-100"
                        onAction={() =>
                          router.push(`/exemplars/${e.id}`)
                        }
                      >
                        <Table.Cell>
                          <Text size="sm" className="line-clamp-2 max-w-[20rem]">
                            {e.content.trim() ? e.content : "—"}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="sm" variant="muted">
                            {exemplarKindLabel(e.kind as ExemplarKind)}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="sm" variant="muted">
                            {channelLabel(e.channel as Channel)}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="sm">
                            {ratingLabel(e.rating as Rating)}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="sm" variant="muted">
                            {e.createdAt.slice(0, 10)}
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
