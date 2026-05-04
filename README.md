## Maya Ops (licenseandscale)

Maya Torres runs two workflows on one pipeline: **Content Studio** and **DM Triage**. Planner → Writer (semantic exemplar retrieval via pgvector) → deterministic rubric + critic; approvals persist to Postgres so the next generation can retrieve them.

Architecture:

```
┌─────────────┐ ┌─────────────┐
│   Studio    │ │   Inbox     │
└──────┬──────┘ └──────┬───────┘
       └───────┬───────┘
               ▼
      Plan → Write → Critique
               ▼
         Exemplar store
```

The app shell is Next.js route group `app/(app)/` with sidebar nav (Studio, Inbox, Exemplars) and a calendar section. **`/` redirects to `/studio`.**

Stack: **Next.js 16**, **React 19**, **Prisma 5**, **PostgreSQL + pgvector**, **Vercel AI SDK** (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/react`).

### Prerequisites

- Node 20+
- Postgres **with pgvector** (Docker image recommended)
- `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` (embeddings only), `DATABASE_URL`

### Setup

Start Postgres:

```bash
docker run -d --name maya-pg -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  pgvector/pgvector:pg16
```

Create **`.env.local`** in the repo root (Next.js loads it in dev):

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres"
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
```

Sync schema:

```bash
npm run db:generate
npm run db:enable-pgvector
npm run db:push
```

If `db:push` fails with **`type vector does not exist`** and you skipped the line above: run **`npm run db:enable-pgvector`** once. If that command reports that the **`vector`** extension is unavailable, this database was not built with pgvector — start **`pgvector/pgvector:pg16`** instead of plain `postgres` (see Prerequisites).

If the app or APIs return **`P2021` / table does not exist**, the schema was never applied to the database backing `DATABASE_URL`. Run **`npm run db:push`** from the repo root with the same env your dev server uses (e.g. `.env.local`). API routes return **503** with a short reminder when Prisma detects this.

Apply the cosine IVFFLAT index Prisma cannot model (adjust `lists` once you have more rows):

```bash
psql "$DATABASE_URL" -f prisma/create_vector_index.sql
```

Seed embeddings + DM threads:

```bash
npm run db:seed
```

`npm install` runs **`prisma generate`** via **postinstall**.

### Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Production server (`next start` after build) |
| `npm run lint` | ESLint |
| `npm run db:generate` | `prisma generate` |
| `npm run db:push` | Push schema |
| `npm run db:enable-pgvector` | Enable `vector` extension (once per DB) |
| `npm run db:seed` | Seed exemplars + DMs |
| `npm run db:studio` | Prisma Studio |

### Demo path

1. Open **`/studio`**, pick channel + offer, create a draft with a topic, open the draft, and run generation. Inspect the rubric + critic panel.
2. Approve / edit / reject and confirm new rows on **`/exemplars`** (voice-memory retrieval sources). **`GET /api/exemplars/stats`** returns positive/negative totals as JSON.
3. Open **`/exemplars`** for the full read-only list; edited text promotes as positives; rejects store negatives with reasons.
4. Open **`/inbox`**, run the classifier, generate a DM reply (`DM_REPLY`), then **Send** to approve and persist an outbound row + exemplar slice.
5. Open **`/studio/calendar`**, schedule a draft, and confirm it appears on the chosen day.

### What is real vs. mocked

**Real:** Postgres + pgvector retrieval, embeddings on approval/edit/reject, pipeline wiring (planner, writer, critic), DM classifier, calendar listing from `scheduledFor`, streaming generation via **`POST /api/generate`**.

**Mock / not built:** outbound delivery to IG, SSO, OAuth for social, drag-drop scheduling, analytics.

### Implementation notes

- Writer uses **`ToolLoopAgent`** with **`instructions:`** ([`lib/agents/writer.ts`](lib/agents/writer.ts)).
- Vector search uses **`$queryRaw`** and `<=>` ([`lib/exemplars.ts`](lib/exemplars.ts)).
- Draft and DM reply UIs use **`useChat`** from **`@ai-sdk/react`** against **`/api/generate`** (`app/(app)/studio/drafts/[id]/draft-detail-client.tsx`, `app/(app)/inbox/threads/[id]/inbox-thread-detail-client.tsx`); transport setup lives in [`hooks/use-generation-chat.ts`](hooks/use-generation-chat.ts).

### Next (if extending)

Richer edit-diff modeling, attribution, repurposing graphs, and wiring optional UI (e.g. exemplar aggregate chips) where it helps operators.
