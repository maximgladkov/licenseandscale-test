import { ScheduledDay } from "./scheduled-day";
import { parseDate } from "@internationalized/date";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ date: string }>;
};

export default async function CalendarDatePage({ params }: Props) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();
  try {
    parseDate(date);
  } catch {
    notFound();
  }
  return <ScheduledDay date={date} />;
}
