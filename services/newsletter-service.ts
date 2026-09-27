import { z } from "zod";
import { prisma } from "@/lib/db";

const emailSchema = z.email().max(254);

export type NewsletterResult = { ok: true } | { ok: false; error: string };

/**
 * Inscrit une adresse à la newsletter. Idempotent : une adresse déjà inscrite renvoie le même succès,
 * sans révéler qu'elle était connue.
 */
export async function subscribeToNewsletter(rawEmail: unknown): Promise<NewsletterResult> {
  const parsed = emailSchema.safeParse(typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : rawEmail);
  if (!parsed.success) return { ok: false, error: "Adresse e-mail invalide." };

  await prisma.newsletterSubscriber.upsert({
    where: { email: parsed.data },
    create: { email: parsed.data },
    update: {},
  });
  return { ok: true };
}
