import { z } from "zod";

export const zExemplarKind = z.enum(["CONTENT_POST", "DM_REPLY"]);

export const zChannel = z.enum([
  "IG_CAPTION",
  "REEL_SCRIPT",
  "CAROUSEL",
  "YOUTUBE_INTRO",
  "STORY_QA",
  "DM",
]);

export const zOffer = z.enum([
  "COURSE",
  "ACCELERATOR",
  "INNER_CIRCLE",
  "NONE",
]);
