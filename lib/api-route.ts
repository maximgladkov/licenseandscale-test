import { prismaClientErrorResponse } from "@/lib/prisma-http";
import type { RouteErrorOpts } from "@/types/route-error-opts";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "./http-error";

export { HttpError };

export function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function jsonInvalidQuery(): NextResponse {
  return jsonError(400, "Invalid query");
}

export function invalidJsonBodyResponse(): NextResponse {
  return jsonError(400, "Invalid JSON body");
}

export function zodValidationErrorResponse(error: ZodError): NextResponse {
  return NextResponse.json({ error: error.flatten().fieldErrors }, { status: 400 });
}

export async function readJsonBody(
  req: Request,
): Promise<{ ok: true; data: unknown } | { ok: false; response: NextResponse }> {
  try {
    return { ok: true, data: await req.json() };
  } catch {
    return { ok: false, response: invalidJsonBodyResponse() };
  }
}

export function routeError(e: unknown, opts: RouteErrorOpts): NextResponse {
  const pe = prismaClientErrorResponse(e);
  if (pe) return pe;
  if (e instanceof HttpError) {
    return jsonError(e.status, e.message);
  }
  if (e instanceof ZodError) {
    return zodValidationErrorResponse(e);
  }
  const status = opts.status ?? 500;
  const shouldLog = opts.log ?? status >= 500;
  if (shouldLog) console.error(e);
  const msg =
    opts.preferErrorMessage && e instanceof Error
      ? e.message
      : opts.fallbackMessage;
  return NextResponse.json({ error: msg }, { status });
}
