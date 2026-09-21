import { createHash } from "node:crypto";
import { prisma } from "./db";

// Limitation de débit à fenêtre fixe, stockée en base : fonctionne sur un hébergement serverless
// (pas d'état en mémoire) et l'incrément est atomique (un seul INSERT … ON CONFLICT).

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

/** Clé opaque : l'adresse IP n'est jamais stockée en clair. */
export function rateLimitKey(scope: string, identifier: string): string {
  return `${scope}:${createHash("sha256").update(identifier).digest("hex").slice(0, 32)}`;
}

/** Adresse du client. `x-forwarded-for` n'est fiable que derrière un proxy de confiance (Vercel, etc.). */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || "unknown";
}

export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  // Les colonnes sont « timestamp sans fuseau » (UTC, comme Prisma) : on compare donc à now() en UTC.
  const rows = await prisma.$queryRaw<{ count: number; windowStart: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart")
    VALUES (${key}, 1, now() AT TIME ZONE 'UTC')
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimit"."windowStart" <= (now() AT TIME ZONE 'UTC') - (${windowSeconds} * interval '1 second')
        THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE
        WHEN "RateLimit"."windowStart" <= (now() AT TIME ZONE 'UTC') - (${windowSeconds} * interval '1 second')
        THEN now() AT TIME ZONE 'UTC' ELSE "RateLimit"."windowStart" END
    RETURNING "count", "windowStart"`;

  const { count, windowStart } = rows[0];
  const elapsed = (Date.now() - windowStart.getTime()) / 1000;
  return { allowed: count <= limit, retryAfterSeconds: Math.max(1, Math.ceil(windowSeconds - elapsed)) };
}

/** Purge les compteurs périmés (appelée par la réconciliation). */
export async function purgeRateLimits(olderThanSeconds = 24 * 3600): Promise<number> {
  return prisma.$executeRaw`
    DELETE FROM "RateLimit"
    WHERE "windowStart" < (now() AT TIME ZONE 'UTC') - (${olderThanSeconds} * interval '1 second')`;
}
