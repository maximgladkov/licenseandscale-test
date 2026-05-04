import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

const KNOWN: Record<string, string> = {
  P2021:
    "Tables are missing. Apply the schema: npm run db:push — then optionally npm run db:seed and prisma/create_vector_index.sql (see README).",
  P1001:
    "Cannot reach Postgres. Start your database container and verify DATABASE_URL in .env.local.",
  P1003:
    "Database does not exist. Create it or point DATABASE_URL to an existing Postgres (with pgvector).",
};

export function prismaClientErrorMessage(error: unknown): string | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return KNOWN[error.code] ?? null;
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return "Prisma failed to initialize. Set DATABASE_URL in .env.local and ensure Postgres is running.";
  }
  return null;
}

export function prismaClientErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    if (error instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json(
        {
          error: prismaClientErrorMessage(error),
        },
        { status: 503 },
      );
    }
    return null;
  }
  const message = KNOWN[error.code];
  if (!message) return null;
  return NextResponse.json(
    { error: message, prismaCode: error.code },
    { status: 503 },
  );
}
