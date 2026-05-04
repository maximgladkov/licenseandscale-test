import type {
  Channel,
  DmDirection,
  DmIntent,
  DmTemperature,
  DraftStatus,
  ExemplarKind,
  Offer,
  Rating,
} from "@prisma/client";

const CHANNEL_LABELS: Record<Channel, string> = {
  IG_CAPTION: "Instagram caption",
  REEL_SCRIPT: "Reels script",
  CAROUSEL: "Carousel",
  YOUTUBE_INTRO: "YouTube intro",
  STORY_QA: "Stories Q&A",
  DM: "Direct message",
};

const OFFER_LABELS: Record<Offer, string> = {
  COURSE: "Course",
  ACCELERATOR: "Accelerator",
  INNER_CIRCLE: "Inner Circle",
  NONE: "No offer push",
};

const EXEMPLAR_KIND_LABELS: Record<ExemplarKind, string> = {
  CONTENT_POST: "Content post",
  DM_REPLY: "DM reply",
};

const DRAFT_STATUS_LABELS: Record<DraftStatus, string> = {
  PENDING: "Pending review",
  APPROVED: "Approved",
  EDITED: "Edited after review",
  REJECTED: "Rejected",
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
};

const RATING_LABELS: Record<Rating, string> = {
  POSITIVE: "Good example",
  NEGATIVE: "Anti-example",
};

const DM_INTENT_LABELS: Record<DmIntent, string> = {
  PURCHASE_READY: "Purchase ready",
  PRODUCT_QUALITY: "Product question",
  PRICE_SHOPPER: "Pricing focused",
  GENERAL_QUESTION: "General question",
  NOT_A_FIT: "Not a fit",
  SPAM: "Spam",
  OBJECTION: "Objection / stall",
};

const DM_TEMPERATURE_LABELS: Record<DmTemperature, string> = {
  HOT: "Hot lead",
  WARM: "Warm curiosity",
  COLD: "Cold / low intent",
};

const DM_DIRECTION_LABELS: Record<DmDirection, string> = {
  INBOUND: "Inbound",
  OUTBOUND: "Outbound",
};

const CRITIQUE_VERDICT_LABELS: Record<string, string> = {
  ship: "Ship",
  revise: "Needs revision",
};

const RUBRIC_CHECK_LABELS: Record<string, string> = {
  avgSentenceLength: "Average sentence length",
  corporateJargonCount: "Corporate jargon",
  emDashCount: "Em-dash usage",
  hasHook: "Opening hook",
  hasCta: "Call to action",
  lengthInBounds: "Word count fit",
  passivesCount: "Passive voice",
  hedgingCount: "Hedging language",
};

function titleSnakeFallback(raw: string) {
  return raw
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function channelLabel(value: string) {
  return CHANNEL_LABELS[value as Channel] ?? titleSnakeFallback(value);
}

export function offerLabel(value: string) {
  return OFFER_LABELS[value as Offer] ?? titleSnakeFallback(value);
}

export function exemplarKindLabel(value: string) {
  return EXEMPLAR_KIND_LABELS[value as ExemplarKind] ?? titleSnakeFallback(value);
}

export function draftStatusLabel(value: string) {
  return DRAFT_STATUS_LABELS[value as DraftStatus] ?? titleSnakeFallback(value);
}

export function ratingLabel(value: string) {
  return RATING_LABELS[value as Rating] ?? titleSnakeFallback(value);
}

export function dmIntentLabel(value: string | null | undefined) {
  if (value == null) return "";
  return DM_INTENT_LABELS[value as DmIntent] ?? titleSnakeFallback(value);
}

export function dmTemperatureLabel(value: string | null | undefined) {
  if (value == null) return "";
  return DM_TEMPERATURE_LABELS[value as DmTemperature] ?? titleSnakeFallback(value);
}

export function dmDirectionLabel(value: string) {
  return DM_DIRECTION_LABELS[value as DmDirection] ?? titleSnakeFallback(value);
}

export function critiqueVerdictLabel(verdict: string) {
  return CRITIQUE_VERDICT_LABELS[verdict] ?? verdict;
}

export function rubricCheckLabel(id: string) {
  return RUBRIC_CHECK_LABELS[id] ?? splitCamelFallback(id);
}

function splitCamelFallback(id: string) {
  const spaced = id.replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export const CHANNEL_SELECT_OPTIONS = (
  ["IG_CAPTION", "REEL_SCRIPT", "CAROUSEL", "YOUTUBE_INTRO", "STORY_QA", "DM"] as const
).map((value) => ({
  value,
  label: CHANNEL_LABELS[value],
}));

export const OFFER_SELECT_OPTIONS = (
  ["COURSE", "ACCELERATOR", "INNER_CIRCLE", "NONE"] as const
).map((value) => ({
  value,
  label: OFFER_LABELS[value],
}));
