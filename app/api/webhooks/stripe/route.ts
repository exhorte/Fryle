import { getStripeWebhookSecret } from "@/lib/env";
import { log } from "@/lib/log";
import { getStripe } from "@/lib/stripe";
import { refundUnfulfillableOrders } from "@/services/auto-refund-service";
import { processStripeEvent } from "@/services/stripe-webhook-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing stripe-signature header", { status: 400 });

  // Corps brut, exactement tel que reçu : la signature porte sur ces octets.
  const rawBody = await request.text();

  let webhookSecret: string;
  try {
    webhookSecret = getStripeWebhookSecret();
  } catch (error) {
    log("error", "webhook_misconfigured", { error: error instanceof Error ? error.message : String(error) });
    return new Response("Webhook not configured", { status: 500 });
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    log("warn", "webhook_invalid_signature");
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    const result = await processStripeEvent(event);
    if (result === "processed" && event.type.startsWith("checkout.session.")) {
      // Paiement encaissé pour une commande devenue impossible à honorer : remboursement immédiat.
      // Meilleur effort : un échec ici ne doit pas faire rejouer le webhook (la réconciliation reprend).
      await refundUnfulfillableOrders(5).catch((error: unknown) =>
        log("error", "auto_refund_after_webhook_failed", {
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
    return Response.json({ received: true, result });
  } catch (error) {
    // 500 → Stripe relivre l'événement avec un délai croissant. Rien n'a été enregistré (transaction annulée).
    log("error", "webhook_processing_failed", {
      stripeEventId: event.id,
      eventType: event.type,
      error: error instanceof Error ? error.message : String(error),
    });
    return new Response("Webhook processing failed", { status: 500 });
  }
}
