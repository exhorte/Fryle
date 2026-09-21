"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-session";
import { log } from "@/lib/log";
import { checkRateLimit, clientIp, rateLimitKey } from "@/lib/rate-limit";
import { CheckoutError, createCheckoutSession } from "@/services/checkout-service";

export type CheckoutState = { error?: string };

// Un visiteur peut réserver du stock sans payer : on borne le nombre de tentatives par adresse IP.
const RATE_LIMIT = { attempts: 15, windowSeconds: 10 * 60 };

function parsePayload(raw: FormDataEntryValue | null): unknown {
  try {
    return JSON.parse(String(raw ?? ""));
  } catch {
    return null; // rejeté comme panier invalide par la validation du service
  }
}

/**
 * Reçoit { cartId, items: [{ productId, quantity }] } — jamais de prix, de total ni d'identifiant utilisateur.
 * Tout est revalidé et recalculé côté serveur depuis la base ; l'utilisateur vient de la session.
 */
export async function checkoutAction(_previous: CheckoutState, formData: FormData): Promise<CheckoutState> {
  let url: string;
  try {
    const limit = await checkRateLimit(
      rateLimitKey("checkout", clientIp(await headers())),
      RATE_LIMIT.attempts,
      RATE_LIMIT.windowSeconds,
    );
    if (!limit.allowed) {
      const minutes = Math.ceil(limit.retryAfterSeconds / 60);
      return { error: `Too many attempts. Please try again in ${minutes} minute${minutes > 1 ? "s" : ""}.` };
    }

    const user = await getCurrentUser();
    ({ url } = await createCheckoutSession(parsePayload(formData.get("payload")), {
      userId: user?.id,
      email: user?.email,
    }));
  } catch (error) {
    if (error instanceof CheckoutError) return { error: error.message };
    log("error", "checkout_action_failed", { error: error instanceof Error ? error.message : String(error) });
    return { error: "Unable to start payment. Please try again." };
  }
  // redirect() lève une exception de contrôle : à appeler hors du try/catch.
  redirect(url);
}
