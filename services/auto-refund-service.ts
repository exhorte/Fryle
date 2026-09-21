import { prisma } from "@/lib/db";
import { log } from "@/lib/log";
import { getStripe } from "@/lib/stripe";

// Cas couvert : le client a payé (session encore payable ou paiement asynchrone), mais entre-temps la commande
// avait été relâchée et le stock a été vendu à quelqu'un d'autre. L'argent est encaissé pour une commande
// impossible à honorer : on rembourse automatiquement et intégralement.
//
// Ne concerne PAS les écarts de montant (AMOUNT_MISMATCH) : ils restent à vérifier à la main.
//
// Le remboursement est déclenché juste après le webhook, puis rattrapé par la réconciliation si l'appel
// Stripe a échoué. La clé d'idempotence garantit qu'un même paiement n'est jamais remboursé deux fois.
// Le statut Refund / Payment / Order est ensuite mis à jour par les webhooks refund.*.

export type AutoRefundSummary = { attempted: number; refunded: number; errors: number };

export async function refundUnfulfillableOrders(limit = 10): Promise<AutoRefundSummary> {
  const orders = await prisma.order.findMany({
    where: {
      needsReview: true,
      reviewReason: "OUT_OF_STOCK",
      payments: { some: { status: "SUCCEEDED", refundedCents: 0, stripePaymentIntentId: { not: null } } },
      refunds: { none: {} },
    },
    include: { payments: true },
    take: limit,
  });

  const summary: AutoRefundSummary = { attempted: orders.length, refunded: 0, errors: 0 };
  if (orders.length === 0) return summary;
  const stripe = getStripe();

  for (const order of orders) {
    const payment = order.payments.find((p) => p.status === "SUCCEEDED" && p.stripePaymentIntentId);
    if (!payment?.stripePaymentIntentId) continue;
    try {
      await stripe.refunds.create(
        {
          payment_intent: payment.stripePaymentIntentId,
          metadata: { orderId: order.id, reason: "unfulfillable_out_of_stock" },
        },
        { idempotencyKey: `auto-refund-${order.id}` },
      );
      summary.refunded++;
      log("warn", "auto_refund_created", { orderId: order.id, stripePaymentIntentId: payment.stripePaymentIntentId });
    } catch (error) {
      summary.errors++;
      log("error", "auto_refund_failed", {
        orderId: order.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return summary;
}
