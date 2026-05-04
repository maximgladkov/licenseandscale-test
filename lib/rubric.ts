import type { Channel, Offer } from "@prisma/client";
import type { RubricCheck } from "@/types/rubric-check";
import type { RubricResult } from "@/types/rubric-result";

const JARGON = [
  "leverage",
  "utilize",
  "synergy",
  "ecosystem",
  "bandwidth",
  "circle back",
  "deep dive",
  "low-hanging fruit",
  "value-add",
  "touch base",
  "roi-driven",
  "mission-critical",
  "paradigm",
] as const;

const HEDGES = [
  "just",
  "maybe",
  "perhaps",
  "kind of",
  "sort of",
  "i think",
] as const;

const PASSIVE_MARKERS = [
  /\bwas\s+\w+ed\b/gi,
  /\bwere\s+\w+ed\b/gi,
  /\bbeen\s+\w+ed\b/gi,
  /\bis\s+\w+ed\b/gi,
  /\bare\s+\w+ed\b/gi,
  /\bam\s+\w+ed\b/gi,
];

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function sentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function avgSentenceLength(text: string) {
  const s = sentences(text);
  if (s.length === 0) return 0;
  const lengths = s.map((x) => wordCount(x));
  return lengths.reduce((a, b) => a + b, 0) / lengths.length;
}

function countInsensitive(hay: string, needle: string) {
  const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  return (hay.match(re) ?? []).length;
}

function corporateJargonCount(text: string) {
  let n = 0;
  for (const w of JARGON) n += countInsensitive(text, w);
  return n;
}

function emDashCount(text: string) {
  return (text.match(/—/g) ?? []).length;
}

function hasHook(text: string) {
  const first = sentences(text)[0] ?? "";
  const wc = wordCount(first);
  const lower = first.toLowerCase();
  const greeting = /^(hi|hey|hello|good morning|what's up)\b/.test(lower);
  return wc > 0 && wc < 12 && !greeting;
}

function hasCta(text: string, channel: Channel, offer: Offer) {
  if (channel === "STORY_QA") return true;
  const lower = text.toLowerCase();
  if (channel === "DM") {
    if (offer === "NONE") return wordCount(text) >= 8;
    return (
      lower.includes("inner circle") ||
      lower.includes("accelerator") ||
      lower.includes("course") ||
      lower.includes("dm me") ||
      lower.includes("link") ||
      /\?/.test(text)
    );
  }
  if (channel === "IG_CAPTION" || channel === "REEL_SCRIPT" || channel === "CAROUSEL" || channel === "YOUTUBE_INTRO") {
    return (
      lower.includes("dm") ||
      lower.includes("link") ||
      lower.includes("comment") ||
      lower.includes("course") ||
      lower.includes("sign up") ||
      lower.includes("apply")
    );
  }
  return true;
}

function lengthBounds(channel: Channel): { min: number; max: number } {
  switch (channel) {
    case "STORY_QA":
      return { min: 15, max: 150 };
    case "DM":
      return { min: 12, max: 220 };
    case "REEL_SCRIPT":
      return { min: 35, max: 400 };
    case "CAROUSEL":
      return { min: 35, max: 400 };
    case "YOUTUBE_INTRO":
      return { min: 40, max: 400 };
    case "IG_CAPTION":
    default:
      return { min: 30, max: 320 };
  }
}

function lengthInBounds(text: string, channel: Channel) {
  const w = wordCount(text);
  const { min, max } = lengthBounds(channel);
  return w >= min && w <= max;
}

function passivesCount(text: string) {
  let n = 0;
  for (const re of PASSIVE_MARKERS) {
    const m = text.match(re);
    if (m) n += m.length;
  }
  return n;
}

function hedgingCount(text: string) {
  const lower = text.toLowerCase();
  let n = 0;
  for (const h of HEDGES) {
    const re = new RegExp(`\\b${h.replace(/\s+/g, "\\s+")}\\b`, "gi");
    n += (lower.match(re) ?? []).length;
  }
  return n;
}

function partialScoreUpperBound(value: number, limit: number, slack: number) {
  if (slack <= 0) return value <= limit ? 100 : 0;
  if (value <= limit) return 100;
  const over = value - limit;
  return Math.max(0, 100 - (over / slack) * 100);
}

function lengthPartialPercent(
  wordCountValue: number,
  min: number,
  max: number,
) {
  if (wordCountValue <= 0) return 0;
  if (wordCountValue >= min && wordCountValue <= max) return 100;
  if (wordCountValue < min) {
    return Math.max(0, Math.min(100, (wordCountValue / min) * 100));
  }
  const slack = Math.max(12, max * 0.2);
  return partialScoreUpperBound(wordCountValue, max, slack);
}

export function rubricCheckPartialPercent(c: RubricCheck): number {
  switch (c.name) {
    case "avgSentenceLength": {
      const v = c.value;
      if (v <= 0) return 0;
      return Math.max(0, 100 - Math.max(0, v - 11) * (100 / 19));
    }
    case "corporateJargonCount":
      return partialScoreUpperBound(c.value, c.threshold, 4);
    case "emDashCount":
      return partialScoreUpperBound(c.value, c.threshold, 5);
    case "hasHook":
    case "hasCta":
      return c.value >= c.threshold ? 100 : 0;
    case "lengthInBounds": {
      const min = c.thresholdMin ?? 0;
      const max = c.threshold;
      return lengthPartialPercent(c.value, min, max);
    }
    case "passivesCount":
      return partialScoreUpperBound(c.value, c.threshold, 6);
    case "hedgingCount":
      return partialScoreUpperBound(c.value, c.threshold, 8);
    default:
      return c.pass ? 100 : 0;
  }
}

function aggregateRubricScore(checks: RubricCheck[]) {
  if (checks.length === 0) return 0;
  const sum = checks.reduce((acc, c) => acc + rubricCheckPartialPercent(c), 0);
  return Math.round(sum / checks.length);
}

export function runDeterministicChecks(
  draft: string,
  channel: Channel,
  offer: Offer,
): RubricResult {
  const checks: RubricCheck[] = [];
  const asl = avgSentenceLength(draft);
  checks.push({
    name: "avgSentenceLength",
    pass: asl <= 18,
    value: Math.round(asl * 10) / 10,
    threshold: 18,
  });
  const jargon = corporateJargonCount(draft);
  checks.push({
    name: "corporateJargonCount",
    pass: jargon === 0,
    value: jargon,
    threshold: 0,
  });
  const em = emDashCount(draft);
  checks.push({
    name: "emDashCount",
    pass: em <= 1,
    value: em,
    threshold: 1,
  });
  checks.push({
    name: "hasHook",
    pass: hasHook(draft),
    value: hasHook(draft) ? 1 : 0,
    threshold: 1,
  });
  checks.push({
    name: "hasCta",
    pass: hasCta(draft, channel, offer),
    value: hasCta(draft, channel, offer) ? 1 : 0,
    threshold: 1,
  });
  const inBounds = lengthInBounds(draft, channel);
  const bounds = lengthBounds(channel);
  checks.push({
    name: "lengthInBounds",
    pass: inBounds,
    value: wordCount(draft),
    threshold: bounds.max,
    thresholdMin: bounds.min,
  });
  const pass = passivesCount(draft);
  checks.push({
    name: "passivesCount",
    pass: pass <= 2,
    value: pass,
    threshold: 2,
  });
  const hedge = hedgingCount(draft);
  checks.push({
    name: "hedgingCount",
    pass: hedge <= 4,
    value: hedge,
    threshold: 4,
  });
  const score = aggregateRubricScore(checks);
  return { checks, score };
}
