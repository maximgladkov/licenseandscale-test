"use client";

import { AppPageShell } from "@/components/app-page-shell";
import { usePageBreadcrumbLabel } from "@/hooks/use-app-breadcrumb";
import {
  channelLabel,
  exemplarKindLabel,
  ratingLabel,
} from "@/lib/enum-labels";
import type { ExemplarClientJson } from "@/types/exemplar";
import { Card, Chip, Description, Link, Text } from "@heroui/react";
import { Channel, ExemplarKind, Rating } from "@prisma/client";
import NextLink from "next/link";

type ExemplarDetailClientProps = {
  initialExemplar: ExemplarClientJson;
};

export default function ExemplarDetailClient({
  initialExemplar,
}: ExemplarDetailClientProps) {
  const e = initialExemplar;

  usePageBreadcrumbLabel(
    `${exemplarKindLabel(e.kind as ExemplarKind)} · ${channelLabel(e.channel as Channel)}`,
  );

  return (
    <AppPageShell
      title="Exemplar"
      description="Read-only reference entry used for voice-memory retrieval. Open the source draft in Studio when linked."
    >
      <div className="flex w-full flex-col gap-1">
        <div className="flex flex-row flex-wrap items-center gap-2">
          <Chip size="sm">{exemplarKindLabel(e.kind as ExemplarKind)}</Chip>
          <Chip size="sm" variant="tertiary">
            {channelLabel(e.channel as Channel)}
          </Chip>
          <Chip size="sm" variant={e.rating === Rating.POSITIVE ? "primary" : "soft"}>
            {ratingLabel(e.rating as Rating)}
          </Chip>
        </div>
        <Description>
          <Text size="xs" variant="muted" className="font-mono">
            {e.id}
          </Text>
        </Description>
      </div>

      <Card variant="secondary">
        <Card.Content className="flex flex-col gap-2">
          <Text size="sm" variant="muted">
            Created {e.createdAt.slice(0, 10)}
          </Text>
          {e.sourceDraftId ? (
            <div className="flex flex-row flex-wrap items-center gap-2">
              <Text size="sm" variant="muted">
                Source draft
              </Text>
              <Link
                render={({ className, children }) => (
                  <NextLink href={`/studio/drafts/${e.sourceDraftId}`} className={className}>
                    {children}
                  </NextLink>
                )}
              >
                Open in Studio
              </Link>
            </div>
          ) : (
            <Text size="sm" variant="muted">
              No linked draft
            </Text>
          )}
        </Card.Content>
      </Card>

      <Card variant="default">
        <Card.Header>
          <Text size="sm" className="font-medium">
            Content
          </Text>
        </Card.Header>
        <Card.Content className="whitespace-pre-wrap text-sm leading-relaxed">
          {e.content}
        </Card.Content>
      </Card>

      {e.reason ? (
        <Card variant="default">
          <Card.Header>
            <Text size="sm" className="font-medium">
              Reason
            </Text>
          </Card.Header>
          <Card.Content className="whitespace-pre-wrap text-sm leading-relaxed">
            {e.reason}
          </Card.Content>
        </Card>
      ) : null}
    </AppPageShell>
  );
}
