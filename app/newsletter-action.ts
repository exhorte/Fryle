"use server";

import { headers } from "next/headers";
import { log } from "@/lib/log";
import { checkRateLimit, clientIp, rateLimitKey } from "@/lib/rate-limit";
import { subscribeToNewsletter } from "@/services/newsletter-service";

export type NewsletterState = { status: "idle" | "success" | "error"; message?: string };

export async function newsletterAction(_previous: NewsletterState, formData: FormData): Promise<NewsletterState> {
  try {
    const limit = await checkRateLimit(rateLimitKey("newsletter", clientIp(await headers())), 5, 60 * 60);
    if (!limit.allowed) return { status: "error", message: "Trop de tentatives. Réessayez plus tard." };

    const result = await subscribeToNewsletter(formData.get("email"));
    if (!result.ok) return { status: "error", message: result.error };
    return { status: "success", message: "Merci ! Vous êtes inscrit à la newsletter Fryle." };
  } catch (error) {
    log("error", "newsletter_subscribe_failed", { error: error instanceof Error ? error.message : String(error) });
    return { status: "error", message: "Inscription impossible pour le moment. Réessayez plus tard." };
  }
}
