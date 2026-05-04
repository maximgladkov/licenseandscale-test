import { prismaDraftToClientJson } from "@/lib/generation-chat";
import { prisma } from "@/lib/prisma";
import { DraftStatus, ExemplarKind } from "@prisma/client";
import { notFound } from "next/navigation";
import InboxThreadDetailClient from "./inbox-thread-detail-client";

export const dynamic = "force-dynamic";

export default async function InboxThreadDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const row = await prisma.dmThread.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { id: "asc" }, select: { id: true, direction: true, content: true } },
    },
  });
  if (!row) notFound();
  const initialThread = {
    id: row.id,
    senderHandle: row.senderHandle,
    intent: row.intent,
    temperature: row.temperature,
    isResolved: row.isResolved,
    messages: row.messages.map((m) => ({
      id: m.id,
      direction: m.direction,
      content: m.content,
    })),
  };
  const pendingReplyDraft = await prisma.draft.findFirst({
    where: {
      dmThreadId: id,
      status: DraftStatus.PENDING,
      kind: ExemplarKind.DM_REPLY,
    },
    orderBy: { createdAt: "desc" },
  });
  const initialReplyDraft = pendingReplyDraft
    ? prismaDraftToClientJson(pendingReplyDraft)
    : null;
  return (
    <InboxThreadDetailClient
      key={id}
      initialThread={initialThread}
      initialReplyDraft={initialReplyDraft}
    />
  );
}
