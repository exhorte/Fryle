import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { log } from "@/lib/log";
import {
  applyRefund,
  findPaymentForSession,
  markOrderPaid,
  markPaymentProcessing,
  paidInputFromSession,
  releaseOrder,
  type ReleaseStatus,
  type Tx,
} from "./order-service";

// Événements réellement utiles à cette boutique (paiement unique par Checkout) :
//
//  checkout.session.completed               → paiement confirmé (ou en cours pour les moyens asynchrones)
//  checkout.session.async_payment_succeeded → paiement asynchrone confirmé
//  checkout.session.async_payment_failed    → paiement asynchrone refusé  → stock restitué
//  checkout.session.expired                 → checkout abandonné          → stock restitué
//  refund.created / refund.updated / refund.failed → synchronisation des remboursements
//
// payment_intent.payment_failed est volontairement ignoré : avec Checkout, un échec de carte
// laisse le client réessayer dans la même session ; l'issue définitive est « completed » ou « expired ».
// Chaque opération métier n'a qu'un seul propriétaire (pas de double traitement entre événements).

async function releaseBySession(tx: Tx, session: Stripe.Checkout.Session, status: ReleaseStatus) {
  const payment = await findPaymentForSession(tx, session.id, session.metadata?.orderId ?? null);
  if (!payment) {
    log("warn", "webhook_unknown_payment", { stripeCheckoutSessionId: session.id });
    return;
  }
  const released = await releaseOrder(tx, payment.orderId, status);
  log("info", released ? "order_released" : "order_release_skipped", {
    orderId: payment.orderId,
    stripeCheckoutSessionId: session.id,
    status,
  });
}

async function confirmPayment(tx: Tx, session: Stripe.Checkout.Session) {
  const input = paidInputFromSession(session);
  const outcome = await markOrderPaid(tx, input);
  const level = outcome === "amount_mismatch" || outcome === "needs_review" ? "error" : "info";
  log(level, `payment_${outcome}`, {
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: input.paymentIntentId,
  });
}

async function dispatch(tx: Tx, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.payment_status === "paid") await confirmPayment(tx, session);
      else await markPaymentProcessing(tx, session.id); // moyen de paiement asynchrone : attendre la confirmation
      return;
    }
    case "checkout.session.async_payment_succeeded":
      await confirmPayment(tx, event.data.object);
      return;
    case "checkout.session.async_payment_failed":
      await releaseBySession(tx, event.data.object, "PAYMENT_FAILED");
      return;
    case "checkout.session.expired":
      await releaseBySession(tx, event.data.object, "EXPIRED");
      return;
    case "refund.created":
    case "refund.updated":
    case "refund.failed": {
      const outcome = await applyRefund(tx, event.data.object, new Date(event.created * 1000));
      log("info", `refund_${outcome}`, { stripeRefundId: event.data.object.id, eventType: event.type });
      return;
    }
    default:
      return; // événement non utilisé : consigné comme traité, sans effet
  }
}

/**
 * Traite un événement Stripe déjà vérifié (signature contrôlée par la route).
 *
 * Idempotence : l'enregistrement de l'événement (contrainte UNIQUE sur stripeEventId) et tous ses
 * effets sont dans la même transaction. Une livraison en double — même simultanée — insère 0 ligne
 * et n'a aucun effet ; si le traitement échoue, tout est annulé et Stripe relivrera l'événement.
 */
export async function processStripeEvent(event: Stripe.Event): Promise<"processed" | "duplicate"> {
  return prisma.$transaction(
    async (tx) => {
      const { count } = await tx.stripeEvent.createMany({
        data: [{ stripeEventId: event.id, type: event.type }],
        skipDuplicates: true,
      });
      if (count === 0) {
        log("info", "webhook_duplicate", { stripeEventId: event.id, eventType: event.type });
        return "duplicate" as const;
      }
      await dispatch(tx, event);
      log("info", "webhook_processed", { stripeEventId: event.id, eventType: event.type });
      return "processed" as const;
    },
    { timeout: 15_000 },
  );
}
