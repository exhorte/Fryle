import { prisma } from "@/lib/db";
import { log } from "@/lib/log";
import { getStripe } from "@/lib/stripe";
import { refundUnfulfillableOrders } from "./auto-refund-service";
import { markOrderPaid, markPaymentProcessing, paidInputFromSession, releaseOrder } from "./order-service";

export type SyncOutcome = "skipped" | "paid" | "processing" | "expired" | "open" | "error";

/**
 * Filet de sécurité de la page de succès : si la commande est encore en attente (webhook pas encore
 * arrivé, ou perdu), on demande directement à Stripe l'état de la session et on applique le même
 * traitement que le webhook (mêmes vérifications de montant, même idempotence).
 *
 * L'identifiant de session vient de l'URL, mais il ne sert qu'à retrouver une commande qui existe déjà
 * en base ; l'état du paiement est lu chez Stripe avec la clé secrète, jamais déduit de l'URL.
 */
export async function syncCheckoutSessionFromStripe(checkoutSessionId: string): Promise<SyncOutcome> {
  const payment = await prisma.payment.findUnique({
    where: { stripeCheckoutSessionId: checkoutSessionId },
    include: { order: true },
  });
  // Session inconnue ou commande déjà traitée : aucun appel à Stripe.
  if (!payment || payment.order.status !== "PENDING_PAYMENT") return "skipped";

  try {
    const session = await getStripe().checkout.sessions.retrieve(checkoutSessionId);

    if (session.status === "complete" && session.payment_status === "paid") {
      const outcome = await prisma.$transaction((tx) => markOrderPaid(tx, paidInputFromSession(session)));
      log(outcome === "paid" ? "warn" : "info", "success_page_payment_sync", {
        orderId: payment.orderId,
        stripeCheckoutSessionId: checkoutSessionId,
        outcome,
      });
      if (outcome === "needs_review") await refundUnfulfillableOrders(1);
      return "paid";
    }
    if (session.status === "complete") {
      // Moyen de paiement asynchrone : la confirmation viendra plus tard.
      await prisma.$transaction((tx) => markPaymentProcessing(tx, checkoutSessionId));
      return "processing";
    }
    if (session.status === "expired") {
      await prisma.$transaction((tx) => releaseOrder(tx, payment.orderId, "EXPIRED"));
      return "expired";
    }
    return "open";
  } catch (error) {
    // Stripe indisponible : la page affiche l'état connu en base et se rafraîchit.
    log("error", "success_page_payment_sync_failed", {
      orderId: payment.orderId,
      stripeCheckoutSessionId: checkoutSessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return "error";
  }
}
