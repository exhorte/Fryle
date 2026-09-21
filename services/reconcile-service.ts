import { prisma } from "@/lib/db";
import { log } from "@/lib/log";
import { getStripe } from "@/lib/stripe";
import { markOrderPaid, paidInputFromSession, releaseOrder } from "./order-service";

// Filet de sécurité si un webhook n'est jamais arrivé : pour chaque commande restée en attente
// après l'expiration de sa session, on interroge Stripe et on aligne la base.
// Les webhooks restent le mécanisme principal ; ceci ne fait que rattraper les manques.
const GRACE_MS = 5 * 60 * 1000;

export type ReconcileSummary = { checked: number; paid: number; released: number; errors: number };

export async function reconcilePendingOrders(now = new Date(), limit = 50): Promise<ReconcileSummary> {
  const stale = await prisma.order.findMany({
    where: { status: "PENDING_PAYMENT", expiresAt: { lt: new Date(now.getTime() - GRACE_MS) } },
    include: { payments: true },
    orderBy: { expiresAt: "asc" },
    take: limit,
  });

  const summary: ReconcileSummary = { checked: stale.length, paid: 0, released: 0, errors: 0 };
  const stripe = getStripe();

  for (const order of stale) {
    try {
      const sessionId = order.payments[0]?.stripeCheckoutSessionId;
      if (!sessionId) {
        // La commande n'a jamais obtenu de session Stripe : rien ne peut être payé.
        await prisma.$transaction((tx) => releaseOrder(tx, order.id, "CANCELED"));
        summary.released++;
        continue;
      }

      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.status === "complete" && session.payment_status === "paid") {
        await prisma.$transaction((tx) => markOrderPaid(tx, paidInputFromSession(session)));
        log("warn", "reconcile_missed_payment_webhook", { orderId: order.id, stripeCheckoutSessionId: sessionId });
        summary.paid++;
        continue;
      }

      if (session.status === "open") await stripe.checkout.sessions.expire(sessionId);
      await prisma.$transaction((tx) => releaseOrder(tx, order.id, "EXPIRED"));
      summary.released++;
    } catch (error) {
      summary.errors++;
      log("error", "reconcile_order_failed", {
        orderId: order.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return summary;
}
