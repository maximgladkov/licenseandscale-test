import type { Channel } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { persistExemplar } from "../lib/exemplars";

type PosSeed = {
  channel: Channel;
  content: string;
};

async function wipe() {
  await prisma.edit.deleteMany();
  await prisma.dmMessage.deleteMany();
  await prisma.draft.deleteMany();
  await prisma.exemplar.deleteMany();
  await prisma.dmThread.deleteMany();
}

const positivePosts: PosSeed[] = [
  {
    channel: "IG_CAPTION",
    content:
      "You are not bad at outbound.\nYour process is chaos.\n\nFix three things this week:\n1) Same first line for everyone\n2) No follow-ups after day 5\n3) No record of objections\n\nBoring beats clever every Tuesday.",
  },
  {
    channel: "REEL_SCRIPT",
    content:
      "Cold call math nobody wants.\nTwenty dials.\nEight conversations.\nOne real opp.\n\nThat is Tuesday for most reps.\n\nYour job is rhythm, not magic.",
  },
  {
    channel: "CAROUSEL",
    content:
      "Slide 1: Stop hunting the perfect opener.\nSlide 2: Use one opener for thirty days.\nSlide 3: Track what objections repeat.\nSlide 4: Fix the blocker, rewrite one line.\nSlide 5: DM me CLOSE if you want the script skeleton.",
  },
  {
    channel: "YOUTUBE_INTRO",
    content:
      "If your pipeline swings wild week to week, you do not lack talent.\nYou lack a repeatable first hour.\n\nThis video is ten minutes.\nYou get the hour I give every rep who joins Accelerator.",
  },
  {
    channel: "STORY_QA",
    content:
      "First year I capped at seventy because I chased shiny tactics.\nSecond year I hit two ten with boring habits.\nThe difference was follow-up, not hustle.",
  },
  {
    channel: "IG_CAPTION",
    content:
      "Hot take nobody likes:\nfollow-up is the entire job.\n\nIf you ghost after one no, you deserve the dry pipeline you have.",
  },
  {
    channel: "REEL_SCRIPT",
    content:
      "Confidence is overrated.\nClarity sells.\n\nSay who you help.\nSay the pain.\nAsk one question.\nShut up.",
  },
  {
    channel: "IG_CAPTION",
    content:
      "Inner Circle is not motivation.\nIt is audits, quotas, receipts.\nComment INNER if you want the filter questions before you apply.",
  },
  {
    channel: "CAROUSEL",
    content:
      "Myth: you need charisma.\nTruth: you need a calendar.\nMyth: you need rapport fast.\nTruth: you need a next step with a date.\nMyth: objections end the deal.\nTruth: objections are data.",
  },
  {
    channel: "YOUTUBE_INTRO",
    content:
      "Nobody told me B2B is mostly admin.\nI thought it was guts.\nIt is spreadsheets and discipline.\n\nLet me fix your week so you hate it less.",
  },
];

const negativePosts: string[] = [
  "Let us synergize stakeholder alignment and leverage scalable enablement motions to unlock transformational outcomes across your revenue ecosystem circle back bandwidth.",
  "Always be closing! Crush quotas! Hustle harder! Smash through objections with belief and abundance mindset.",
  "I hear you—I just think maybe we could perhaps deliver value-add—if you're open to chatting—I'd love to sort of unpack your journey synergistically.",
  "Hey queen! Loving your vibe! Sending good energy! ✨💖 Just popping in—no pressure—wanted to softly invite you into my world of manifestation sales.",
  "Hi love! OMG your content speaks to my soul—we should definitely collaborate sometime—no rush—whatever works for your beautiful energy!",
];

async function seedExemplars() {
  for (const e of positivePosts) {
    await persistExemplar({
      kind: "CONTENT_POST",
      channel: e.channel,
      rating: "POSITIVE",
      content: e.content,
      sourceDraftId: null,
    });
  }
  for (const t of negativePosts) {
    await persistExemplar({
      kind: "CONTENT_POST",
      channel: "IG_CAPTION",
      rating: "NEGATIVE",
      content: t,
      sourceDraftId: null,
      reason: "seed_negative_slop",
    });
  }

  await persistExemplar({
    kind: "DM_REPLY",
    channel: "DM",
    rating: "POSITIVE",
    content:
      "Thanks for raising your hand.\nAccelerator is nine weeks.\nGoal is repeatable pipeline rituals, not pep talks.\nIf that matches your speed, DM me APPLY and I'll send criteria.",
    sourceDraftId: null,
  });

  await persistExemplar({
    kind: "DM_REPLY",
    channel: "DM",
    rating: "NEGATIVE",
    content:
      "Heyyyy love your energy—I would LOVE to vibe with you sometime—would you mind if we connected on Zoom for a breakthrough strategy session synergy call?",
    sourceDraftId: null,
    reason: "fake_dm_rapport",
  });
}

async function seedThreads() {
  const threads: {
    handle: string;
    isResolved: boolean;
    messages: string[];
    intent?:
      | "PURCHASE_READY"
      | "PRODUCT_QUALITY"
      | "PRICE_SHOPPER"
      | "GENERAL_QUESTION"
      | "NOT_A_FIT"
      | "SPAM"
      | "OBJECTION";
    temperature?: "HOT" | "WARM" | "COLD";
    outbound?: string;
  }[] = [
    {
      handle: "riley_ae",
      isResolved: false,
      intent: "PURCHASE_READY",
      temperature: "HOT",
      messages: [
        "Saw your $1.2M reel. I'm at $40k and stuck. Tell me about Inner Circle.",
      ],
    },
    {
      handle: "sam_newbie",
      isResolved: false,
      intent: "PRODUCT_QUALITY",
      temperature: "WARM",
      messages: [
        "Is the course worth it for someone with zero sales background?",
      ],
    },
    {
      handle: "chris_lc",
      isResolved: false,
      intent: "GENERAL_QUESTION",
      temperature: "WARM",
      messages: ["SALES"],
    },
    {
      handle: "jordan_accel",
      isResolved: false,
      intent: "GENERAL_QUESTION",
      temperature: "WARM",
      messages: ["How long until I see results in Accelerator?"],
    },
    {
      handle: "taylor_budget",
      isResolved: false,
      intent: "PRICE_SHOPPER",
      temperature: "COLD",
      messages: ["What's the cheapest option?"],
    },
    {
      handle: "pat_mlm",
      isResolved: false,
      intent: "NOT_A_FIT",
      temperature: "COLD",
      messages: ["I sell life insurance MLM, can you help?"],
    },
    {
      handle: "unknown_spammer",
      isResolved: false,
      intent: "SPAM",
      temperature: "COLD",
      messages: [
        "Quick question—we help founders 10× pipeline with AI SDR infra. Open to fifteen minutes?",
      ],
    },
    {
      handle: "morgan_done",
      isResolved: true,
      intent: "PRODUCT_QUALITY",
      temperature: "WARM",
      messages: [
        "Thanks Maya, joined Accelerator last quarter and hit quota two months straight.",
      ],
      outbound:
        "That is receipt energy. DM me PIPELINE anytime you plateau again.",
    },
    {
      handle: "casey_slow",
      isResolved: false,
      intent: "OBJECTION",
      temperature: "COLD",
      messages: [
        "Interested but my manager blocks every tool purchase.",
        "Any low-lift playbook I could try without spend?",
      ],
    },
    {
      handle: "drew_hot",
      isResolved: false,
      intent: "PURCHASE_READY",
      temperature: "HOT",
      messages: [
        "We need pipeline this quarter. Accelerator vs Inner Circle for a five-person team?",
      ],
    },
  ];

  for (const t of threads) {
    const thread = await prisma.dmThread.create({
      data: {
        senderHandle: t.handle,
        isResolved: t.isResolved,
        intent: t.intent ?? undefined,
        temperature: t.temperature ?? undefined,
        messages: {
          create: t.messages.map((content) => ({
            direction: "INBOUND" as const,
            content,
          })),
        },
      },
    });

    if (t.outbound) {
      await prisma.dmMessage.create({
        data: {
          threadId: thread.id,
          direction: "OUTBOUND",
          content: t.outbound,
        },
      });
    }
  }
}

async function main() {
  await wipe();
  await seedExemplars();
  await seedThreads();
  console.info("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
