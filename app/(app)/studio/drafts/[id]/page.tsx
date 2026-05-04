import DraftDetailClient from "./draft-detail-client";
import { prismaDraftToClientJson } from "@/lib/generation-chat";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DraftDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ generate?: string }>;
}) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const row = await prisma.draft.findUnique({ where: { id } });
  if (!row) notFound();
  return (
    <DraftDetailClient
      key={id}
      initialDraft={prismaDraftToClientJson(row)}
      initialPendingGenerate={sp.generate === "1"}
    />
  );
}
