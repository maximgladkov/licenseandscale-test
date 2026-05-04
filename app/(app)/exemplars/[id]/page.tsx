import ExemplarDetailClient from "./exemplar-detail-client";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ExemplarDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const row = await prisma.exemplar.findUnique({
    where: { id },
    select: {
      id: true,
      kind: true,
      channel: true,
      rating: true,
      content: true,
      reason: true,
      sourceDraftId: true,
      createdAt: true,
    },
  });
  if (!row) notFound();
  const initialExemplar = {
    ...row,
    createdAt: row.createdAt.toISOString(),
  };
  return <ExemplarDetailClient initialExemplar={initialExemplar} />;
}
