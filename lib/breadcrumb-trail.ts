import type { BreadcrumbTrailItem } from "@/types/breadcrumb-trail-item";

function titleCaseSegment(seg: string) {
  return seg
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatCalendarDay(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(dt);
}

export function breadcrumbTrailFromPath(pathname: string): BreadcrumbTrailItem[] {
  const normalized = pathname && pathname !== "/" ? pathname : "/studio";
  const segments = normalized.split("/").filter(Boolean);

  if (segments.length === 1 && segments[0] === "studio") {
    return [{ label: "Studio", href: "/studio" }];
  }

  if (segments.length === 1 && segments[0] === "inbox") {
    return [{ label: "Inbox", href: "/inbox" }];
  }

  if (segments.length === 1 && segments[0] === "exemplars") {
    return [{ label: "Exemplars", href: "/exemplars" }];
  }

  if (
    segments[0] === "studio" &&
    segments[1] === "drafts" &&
    segments[2] &&
    segments.length === 3
  ) {
    const id = segments[2];
    return [
      { label: "Studio", href: "/studio" },
      { label: "Draft", href: `/studio/drafts/${id}` },
    ];
  }

  if (
    segments[0] === "inbox" &&
    segments[1] === "threads" &&
    segments[2] &&
    segments.length === 3
  ) {
    const id = segments[2];
    return [
      { label: "Inbox", href: "/inbox" },
      { label: "Thread", href: `/inbox/threads/${id}` },
    ];
  }

  if (segments[0] === "exemplars" && segments[1] && segments.length === 2) {
    const id = segments[1];
    return [
      { label: "Exemplars", href: "/exemplars" },
      { label: "Exemplar", href: `/exemplars/${id}` },
    ];
  }

  if (segments[0] === "studio" && segments[1] === "calendar" && segments.length === 2) {
    return [
      { label: "Studio", href: "/studio" },
      { label: "Calendar", href: "/studio/calendar" },
    ];
  }

  if (
    segments[0] === "studio" &&
    segments[1] === "calendar" &&
    segments[2] &&
    segments.length === 3
  ) {
    const date = segments[2];
    return [
      { label: "Studio", href: "/studio" },
      { label: "Calendar", href: "/studio/calendar" },
      { label: formatCalendarDay(date), href: `/studio/calendar/${date}` },
    ];
  }

  const staticLabel: Record<string, string> = {
    studio: "Studio",
    inbox: "Inbox",
    exemplars: "Exemplars",
    calendar: "Calendar",
    drafts: "Drafts",
    threads: "Threads",
  };

  const out: BreadcrumbTrailItem[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const href = `/${segments.slice(0, i + 1).join("/")}`;
    out.push({
      label: staticLabel[seg] ?? titleCaseSegment(seg),
      href,
    });
  }
  return out;
}
