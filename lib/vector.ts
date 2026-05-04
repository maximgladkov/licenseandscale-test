import { Prisma } from "@prisma/client";

export function vectorLiteral(values: readonly number[]): Prisma.Sql {
  const inner = values
    .map((v) => (Number.isFinite(v) ? v : 0))
    .join(",");
  return Prisma.raw(`'[${inner}]'::vector`);
}
