import type Stripe from "stripe";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { isAutomaticTaxEnabled } from "@/lib/store-config";

export type Tx = Prisma.TransactionClient;

export type StockLine = { productId: string; quantity: number };

// ---------------------------------------------------------------------------
// Stock : réservé au checkout, restitué si la session échoue ou expire.
// Toutes les écritures sont atomiques côté base (UPDATE conditionnel) : pas de
// SELECT puis UPDATE, donc pas de survente même avec des checkouts concurrents.
// ---------------------------------------------------------------------------

function sortLines(lines: StockLine[]): StockLine[] {
  // Ordre stable des verrous de ligne : deux transactions ne peuvent pas se bloquer mutuellement.
  return [...lines].sort((a, b) => a.productId.localeCompare(b.productId));
}

/** Tout ou rien : si une ligne échoue, les lignes déjà réservées sont restituées. */
export async function tryReserveStock(
  tx: Tx,
  lines: StockLine[],
): Promise<{ ok: true } | { ok: false; productId: string }> {
  const reserved: StockLine[] = [];
  for (const line of sortLines(lines)) {
    const { count } = await tx.product.updateMany({
      where: { id: line.productId, active: true, stock: { gte: line.quantity } },
      data: { stock: { decrement: line.quantity } },
    });
    if (count !== 1) {
      for (const done of reserved) {
        await tx.product.update({
          where: { id: done.productId },
          data: { stock: { increment: done.quantity } },
        });
      }
      return { ok: false, productId: line.productId };
    }
    reserved.push(line);
  }
  return { ok: true };
}

async function restockOrder(tx: Tx, orderId: string): Promise<void> {
  const items = await tx.orderItem.findMany({ where: { orderId } });
  for (const item of sortLines(items.map((i) => ({ productId: i.productId, quantity: i.quantity })))) {
    await tx.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } },
    });
  }
}

// ---------------------------------------------------------------------------
// Machine à états des commandes
//
//   PENDING_PAYMENT ─ paiement confirmé ─→ PAID ─ remboursement total ─→ REFUNDED
//        ├─ échec paiement asynchrone ───→ PAYMENT_FAILED   (stock restitué)
//        ├─ session expirée ─────────────→ EXPIRED          (stock restitué)
//        └─ panier modifié / erreur ─────→ CANCELED         (stock restitué)
//
// Chaque transition est un UPDATE conditionnel sur le statut courant : elle n'a lieu
// qu'une seule fois, même si plusieurs événements arrivent en même temps.
// ---------------------------------------------------------------------------

export type ReleaseStatus = "PAYMENT_FAILED" | "EXPIRED" | "CANCELED";

/** PENDING_PAYMENT → statut final + restitution du stock. Renvoie false si déjà traitée. */
export async function releaseOrder(tx: Tx, orderId: string, status: ReleaseStatus): Promise<boolean> {
  const { count } = await tx.order.updateMany({
    where: { id: orderId, status: "PENDING_PAYMENT" },
    data: { status },
  });
  if (count === 0) return false;

  await restockOrder(tx, orderId);
  await tx.payment.updateMany({
    where: { orderId, status: { in: ["PENDING", "PROCESSING"] } },
    data: { status: status === "PAYMENT_FAILED" ? "FAILED" : "CANCELED" },
  });
  return true;
}

export type PaidInput = {
  checkoutSessionId: string;
  orderIdFromMetadata: string | null;
  paymentIntentId: string | null;
  currency: string | null;
  amountShipping: number;
  amountTax: number;
  amountDiscount: number;
  amountTotal: number | null;
  customerEmail: string | null;
  shippingName: string | null;
  shippingAddress: Prisma.InputJsonValue | null;
};

/** Extrait de la session Stripe uniquement ce dont la base a besoin. */
export function paidInputFromSession(session: Stripe.Checkout.Session): PaidInput {
  const shipping = session.collected_information?.shipping_details ?? null;
  return {
    checkoutSessionId: session.id,
    orderIdFromMetadata: session.metadata?.orderId ?? null,
    paymentIntentId:
      typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null),
    currency: session.currency,
    amountShipping: session.total_details?.amount_shipping ?? 0,
    amountTax: session.total_details?.amount_tax ?? 0,
    amountDiscount: session.total_details?.amount_discount ?? 0,
    amountTotal: session.amount_total,
    customerEmail: session.customer_details?.email ?? null,
    shippingName: shipping?.name ?? null,
    shippingAddress: shipping ? { ...shipping.address } : null,
  };
}

export type PaidOutcome =
  | "paid"
  | "already_paid"
  | "unknown_payment"
  | "amount_mismatch"
  | "needs_review";

export async function findPaymentForSession(
  tx: Tx,
  checkoutSessionId: string,
  orderIdFromMetadata: string | null,
) {
  const bySession = await tx.payment.findUnique({
    where: { stripeCheckoutSessionId: checkoutSessionId },
    include: { order: true },
  });
  if (bySession) return bySession;

  // Filet de sécurité : la session Stripe a été créée mais son id n'a pas pu être enregistré.
  if (!orderIdFromMetadata) return null;
  const orphan = await tx.payment.findFirst({
    where: { orderId: orderIdFromMetadata, stripeCheckoutSessionId: null },
    include: { order: true },
  });
  if (!orphan) return null;
  return tx.payment.update({
    where: { id: orphan.id },
    data: { stripeCheckoutSessionId: checkoutSessionId },
    include: { order: true },
  });
}

/** Confirme un paiement reçu. Idempotent et sensible à l'état courant de la commande. */
export async function markOrderPaid(tx: Tx, input: PaidInput): Promise<PaidOutcome> {
  const payment = await findPaymentForSession(tx, input.checkoutSessionId, input.orderIdFromMetadata);
  if (!payment) return "unknown_payment";
  const order = payment.order;

  // Ce que Stripe a encaissé doit correspondre à la commande interne : devise, livraison, aucune remise,
  // et total = sous-total + livraison + taxes (les taxes ne peuvent venir que de Stripe Tax, si activé).
  const expectedTotal = input.amountTotal === null ? null : order.subtotalCents + order.shippingCents + input.amountTax;
  const matches =
    input.currency?.toLowerCase() === order.currency &&
    input.amountShipping === order.shippingCents &&
    input.amountDiscount === 0 &&
    input.amountTax >= 0 &&
    (input.amountTax === 0 || isAutomaticTaxEnabled()) &&
    input.amountTotal === expectedTotal;
  if (!matches) {
    await tx.order.update({ where: { id: order.id }, data: { needsReview: true, reviewReason: "AMOUNT_MISMATCH" } });
    return "amount_mismatch";
  }

  // Détails confirmés par Stripe, enregistrés avec le paiement (total réel, taxes, client, adresse d'expédition).
  const paidDetails = {
    totalCents: input.amountTotal as number,
    taxCents: input.amountTax,
    customerEmail: input.customerEmail,
    shippingName: input.shippingName,
    shippingAddress: input.shippingAddress ?? undefined,
  };

  const finalizePayment = () =>
    tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "SUCCEEDED",
        amountCents: paidDetails.totalCents,
        stripePaymentIntentId: input.paymentIntentId ?? undefined,
        paidAt: new Date(),
      },
    });

  if (order.status === "PAID" || order.status === "REFUNDED") return "already_paid";

  if (order.status === "PENDING_PAYMENT") {
    const { count } = await tx.order.updateMany({
      where: { id: order.id, status: "PENDING_PAYMENT" },
      data: { status: "PAID", ...paidDetails },
    });
    if (count === 1) {
      await finalizePayment();
      return "paid";
    }
    // Un autre événement a traité la commande entre-temps.
    const current = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
    if (current.status === "PAID" || current.status === "REFUNDED") return "already_paid";
  }

  // Paiement tardif sur une commande déjà relâchée (EXPIRED / PAYMENT_FAILED / CANCELED) :
  // l'argent est encaissé, on tente de reprendre le stock.
  const items = await tx.orderItem.findMany({ where: { orderId: order.id } });
  const reservation = await tryReserveStock(
    tx,
    items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
  );
  await finalizePayment();
  if (reservation.ok) {
    await tx.order.update({ where: { id: order.id }, data: { status: "PAID", ...paidDetails } });
    return "paid";
  }
  // Argent encaissé mais plus de stock : remboursement automatique (services/auto-refund-service.ts).
  await tx.order.update({
    where: { id: order.id },
    data: { needsReview: true, reviewReason: "OUT_OF_STOCK", ...paidDetails },
  });
  return "needs_review";
}

export async function markPaymentProcessing(tx: Tx, checkoutSessionId: string): Promise<void> {
  await tx.payment.updateMany({
    where: { stripeCheckoutSessionId: checkoutSessionId, status: "PENDING" },
    data: { status: "PROCESSING" },
  });
}

const REFUND_STATUS = {
  pending: "PENDING",
  requires_action: "PENDING",
  succeeded: "SUCCEEDED",
  failed: "FAILED",
  canceled: "CANCELED",
} as const;

export type RefundOutcome = "applied" | "unknown_payment" | "stale_event";

/** Synchronise un remboursement Stripe (créé depuis le Dashboard, l'API ou un litige résolu). */
export async function applyRefund(
  tx: Tx,
  refund: Stripe.Refund,
  eventCreatedAt: Date,
): Promise<RefundOutcome> {
  const paymentIntentId =
    typeof refund.payment_intent === "string" ? refund.payment_intent : refund.payment_intent?.id;
  if (!paymentIntentId) return "unknown_payment";

  const payment = await tx.payment.findUnique({ where: { stripePaymentIntentId: paymentIntentId } });
  if (!payment) return "unknown_payment";

  // Verrou de ligne : deux remboursements simultanés recalculent le total l'un après l'autre.
  await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${payment.id} FOR UPDATE`;

  const existing = await tx.refund.findUnique({ where: { stripeRefundId: refund.id } });
  if (existing && existing.lastEventAt > eventCreatedAt) return "stale_event";

  const status = REFUND_STATUS[refund.status as keyof typeof REFUND_STATUS] ?? "PENDING";
  const data = {
    amountCents: refund.amount,
    currency: refund.currency.toLowerCase(),
    status,
    reason: refund.reason ?? null,
    lastEventAt: eventCreatedAt,
  };
  await tx.refund.upsert({
    where: { stripeRefundId: refund.id },
    create: { stripeRefundId: refund.id, orderId: payment.orderId, paymentId: payment.id, ...data },
    update: data,
  });

  const { _sum } = await tx.refund.aggregate({
    where: { paymentId: payment.id, status: "SUCCEEDED" },
    _sum: { amountCents: true },
  });
  const refunded = Math.min(_sum.amountCents ?? 0, payment.amountCents);
  const fullyRefunded = refunded >= payment.amountCents;

  await tx.payment.update({
    where: { id: payment.id },
    data: {
      refundedCents: refunded,
      // Un paiement jamais confirmé (ex. échec) ne repasse pas en SUCCEEDED par un remboursement.
      status: fullyRefunded ? "REFUNDED" : refunded > 0 ? "PARTIALLY_REFUNDED" : "SUCCEEDED",
    },
  });

  // La commande ne passe REFUNDED que sur remboursement total ; l'inverse si un remboursement échoue.
  if (fullyRefunded) {
    await tx.order.updateMany({ where: { id: payment.orderId, status: "PAID" }, data: { status: "REFUNDED" } });
    // Commande impossible à honorer, désormais remboursée : plus rien à vérifier.
    await tx.order.updateMany({
      where: { id: payment.orderId, needsReview: true, reviewReason: "OUT_OF_STOCK" },
      data: { needsReview: false },
    });
  } else {
    await tx.order.updateMany({ where: { id: payment.orderId, status: "REFUNDED" }, data: { status: "PAID" } });
  }
  return "applied";
}

// ---------------------------------------------------------------------------
// Lecture pour la page de succès : l'état vient de la base, jamais de l'URL.
// ---------------------------------------------------------------------------

export type OrderStatusView =
  | { state: "not_found" }
  | { state: "paid"; total: string; cartId: string }
  | { state: "refunded" }
  | { state: "processing" }
  | { state: "unpaid" };

export async function getOrderStatusBySessionId(checkoutSessionId: string): Promise<OrderStatusView> {
  const payment = await prisma.payment.findUnique({
    where: { stripeCheckoutSessionId: checkoutSessionId },
    include: { order: true },
  });
  if (!payment) return { state: "not_found" };

  switch (payment.order.status) {
    case "REFUNDED":
      return { state: "refunded" };
    case "PAID":
      return {
        state: "paid",
        total: formatMoney(payment.order.totalCents, payment.order.currency),
        cartId: payment.order.cartId,
      };
    case "PENDING_PAYMENT":
      return { state: "processing" };
    default:
      // Paiement reçu mais commande relâchée : remboursement automatique en cours, ou déjà effectué.
      if (payment.status === "REFUNDED") return { state: "refunded" };
      return payment.status === "SUCCEEDED" ? { state: "processing" } : { state: "unpaid" };
  }
}
