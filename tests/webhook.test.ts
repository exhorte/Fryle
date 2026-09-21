import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { getOrderStatusBySessionId } from "@/services/order-service";
import { processStripeEvent } from "@/services/stripe-webhook-service";
import { createProduct, makeEvent, paidSession, resetDb, startCheckout } from "./helpers";
import { resetStripeMock } from "./stripe-mock";

vi.mock("@/lib/stripe", async () => (await import("./stripe-mock")).stripeModule);

beforeEach(async () => {
  await resetDb();
  resetStripeMock();
});

const stockOf = async (id: string) => (await prisma.product.findUniqueOrThrow({ where: { id } })).stock;
const loadOrder = (id: string) =>
  prisma.order.findUniqueOrThrow({ where: { id }, include: { payments: true, refunds: true } });

/** Commande en attente de paiement : 2 unités réservées sur un stock de 5. */
async function pendingOrder(stock = 5) {
  const product = await createProduct({ stock });
  const checkout = await startCheckout([{ productId: product.id, quantity: 2 }]);
  return { product, ...checkout };
}

describe("webhook : paiement réussi", () => {
  it("checkout.session.completed (payé) → commande PAID, paiement SUCCEEDED, stock conservé", async () => {
    const { product, order, sessionId } = await pendingOrder();

    const result = await processStripeEvent(makeEvent("checkout.session.completed", paidSession(order, sessionId)));

    expect(result).toBe("processed");
    const after = await loadOrder(order.id);
    expect(after.status).toBe("PAID");
    expect(after.payments[0]).toMatchObject({
      status: "SUCCEEDED",
      stripePaymentIntentId: `pi_${sessionId}`,
    });
    expect(after.payments[0].paidAt).not.toBeNull();
    expect(await stockOf(product.id)).toBe(3); // la réservation devient définitive
    expect(await getOrderStatusBySessionId(sessionId)).toMatchObject({ state: "paid" });
  });

  it("completed avec paiement non encore encaissé → PROCESSING, commande toujours en attente", async () => {
    const { order, sessionId } = await pendingOrder();
    await processStripeEvent(
      makeEvent("checkout.session.completed", { ...paidSession(order, sessionId), payment_status: "unpaid" }),
    );
    const after = await loadOrder(order.id);
    expect(after.status).toBe("PENDING_PAYMENT");
    expect(after.payments[0].status).toBe("PROCESSING");
    expect(await getOrderStatusBySessionId(sessionId)).toEqual({ state: "processing" });
  });

  it("async_payment_succeeded confirme ensuite le paiement", async () => {
    const { order, sessionId } = await pendingOrder();
    await processStripeEvent(
      makeEvent("checkout.session.completed", { ...paidSession(order, sessionId), payment_status: "unpaid" }),
    );
    await processStripeEvent(makeEvent("checkout.session.async_payment_succeeded", paidSession(order, sessionId)));
    expect((await loadOrder(order.id)).status).toBe("PAID");
  });

  it("deux événements différents pour le même paiement ne le traitent qu'une fois", async () => {
    const { product, order, sessionId } = await pendingOrder();
    await processStripeEvent(makeEvent("checkout.session.completed", paidSession(order, sessionId)));
    await processStripeEvent(makeEvent("checkout.session.async_payment_succeeded", paidSession(order, sessionId)));

    expect((await loadOrder(order.id)).status).toBe("PAID");
    expect(await stockOf(product.id)).toBe(3);
  });

  it("ne marque pas la commande payée si le montant ne correspond pas", async () => {
    const { order, sessionId } = await pendingOrder();
    await processStripeEvent(
      makeEvent("checkout.session.completed", { ...paidSession(order, sessionId), amount_total: 1 }),
    );
    const after = await loadOrder(order.id);
    expect(after.status).toBe("PENDING_PAYMENT");
    expect(after.needsReview).toBe(true);
    expect(after.reviewReason).toBe("AMOUNT_MISMATCH");
  });

  it("ne marque pas la commande payée si la devise ne correspond pas", async () => {
    const { order, sessionId } = await pendingOrder();
    await processStripeEvent(
      makeEvent("checkout.session.completed", { ...paidSession(order, sessionId), currency: "usd" }),
    );
    const after = await loadOrder(order.id);
    expect(after.status).toBe("PENDING_PAYMENT");
    expect(after.needsReview).toBe(true);
  });

  it("retrouve la commande via metadata.orderId si l'id de session n'a pas été enregistré", async () => {
    const { order, sessionId } = await pendingOrder();
    await prisma.payment.updateMany({ where: { orderId: order.id }, data: { stripeCheckoutSessionId: null } });

    await processStripeEvent(makeEvent("checkout.session.completed", paidSession(order, sessionId)));

    const after = await loadOrder(order.id);
    expect(after.status).toBe("PAID");
    expect(after.payments[0].stripeCheckoutSessionId).toBe(sessionId);
  });
});

describe("webhook : idempotence", () => {
  it("un événement rejoué (même id) n'a aucun effet supplémentaire", async () => {
    const { order, sessionId } = await pendingOrder();
    const event = makeEvent("checkout.session.completed", paidSession(order, sessionId));

    expect(await processStripeEvent(event)).toBe("processed");
    const paidAt = (await loadOrder(order.id)).payments[0].paidAt;

    expect(await processStripeEvent(event)).toBe("duplicate");
    expect(await processStripeEvent(event)).toBe("duplicate");

    expect((await loadOrder(order.id)).payments[0].paidAt).toEqual(paidAt);
    expect(await prisma.stripeEvent.count({ where: { stripeEventId: event.id } })).toBe(1);
  });

  it("des livraisons simultanées du même événement ne sont traitées qu'une fois", async () => {
    const { order, sessionId } = await pendingOrder();
    const event = makeEvent("checkout.session.completed", paidSession(order, sessionId));

    const results = await Promise.all(Array.from({ length: 6 }, () => processStripeEvent(event)));

    expect(results.filter((r) => r === "processed")).toHaveLength(1);
    expect(results.filter((r) => r === "duplicate")).toHaveLength(5);
    expect((await loadOrder(order.id)).status).toBe("PAID");
    expect(await prisma.stripeEvent.count()).toBe(1);
  });

  it("un échec en cours de traitement annule tout, y compris l'enregistrement de l'événement", async () => {
    const { order, sessionId } = await pendingOrder();
    const other = await pendingOrder();
    // Conflit volontaire : le PaymentIntent visé est déjà attribué à une autre commande
    // → violation d'unicité au milieu de la transaction.
    await prisma.payment.updateMany({
      where: { orderId: other.order.id },
      data: { stripePaymentIntentId: `pi_${sessionId}` },
    });
    const event = makeEvent("checkout.session.completed", paidSession(order, sessionId));

    await expect(processStripeEvent(event)).rejects.toThrow();

    expect(await prisma.stripeEvent.count()).toBe(0); // rien d'enregistré : Stripe pourra relivrer
    expect((await loadOrder(order.id)).status).toBe("PENDING_PAYMENT");

    // Le conflit disparaît : la relivraison du même événement réussit.
    await prisma.payment.updateMany({ where: { orderId: other.order.id }, data: { stripePaymentIntentId: null } });
    expect(await processStripeEvent(event)).toBe("processed");
    expect((await loadOrder(order.id)).status).toBe("PAID");
  });

  it("ignore sans erreur un paiement inconnu (autre produit du compte Stripe)", async () => {
    await pendingOrder();
    const before = await prisma.order.count();
    const result = await processStripeEvent(
      makeEvent("checkout.session.completed", {
        id: "cs_unknown",
        payment_status: "paid",
        amount_total: 500,
        currency: "cad",
        payment_intent: "pi_unknown",
        metadata: {},
      }),
    );
    expect(result).toBe("processed");
    expect(await prisma.order.count()).toBe(before);
    expect((await prisma.order.findFirstOrThrow()).status).toBe("PENDING_PAYMENT");
  });

  it("consigne sans effet un type d'événement non géré", async () => {
    expect(await processStripeEvent(makeEvent("customer.created", { id: "cus_1" }))).toBe("processed");
    expect(await prisma.stripeEvent.count()).toBe(1);
  });
});

describe("webhook : échec, expiration, abandon", () => {
  it("checkout.session.expired → EXPIRED et stock restitué", async () => {
    const { product, order, sessionId } = await pendingOrder();
    expect(await stockOf(product.id)).toBe(3);

    await processStripeEvent(makeEvent("checkout.session.expired", { id: sessionId, metadata: { orderId: order.id } }));

    const after = await loadOrder(order.id);
    expect(after.status).toBe("EXPIRED");
    expect(after.payments[0].status).toBe("CANCELED");
    expect(await stockOf(product.id)).toBe(5);
    expect(await getOrderStatusBySessionId(sessionId)).toEqual({ state: "unpaid" });
  });

  it("l'expiration rejouée ne restitue pas le stock deux fois", async () => {
    const { product, order, sessionId } = await pendingOrder();
    const payload = { id: sessionId, metadata: { orderId: order.id } };
    await processStripeEvent(makeEvent("checkout.session.expired", payload));
    await processStripeEvent(makeEvent("checkout.session.expired", payload)); // autre event.id, même effet attendu
    expect(await stockOf(product.id)).toBe(5);
  });

  it("async_payment_failed → PAYMENT_FAILED, paiement FAILED, stock restitué", async () => {
    const { product, order, sessionId } = await pendingOrder();
    await processStripeEvent(
      makeEvent("checkout.session.async_payment_failed", { id: sessionId, metadata: { orderId: order.id } }),
    );
    const after = await loadOrder(order.id);
    expect(after.status).toBe("PAYMENT_FAILED");
    expect(after.payments[0].status).toBe("FAILED");
    expect(await stockOf(product.id)).toBe(5);
  });

  it("l'expiration d'une commande déjà payée ne change rien", async () => {
    const { product, order, sessionId } = await pendingOrder();
    await processStripeEvent(makeEvent("checkout.session.completed", paidSession(order, sessionId)));
    await processStripeEvent(makeEvent("checkout.session.expired", { id: sessionId, metadata: { orderId: order.id } }));
    expect((await loadOrder(order.id)).status).toBe("PAID");
    expect(await stockOf(product.id)).toBe(3);
  });

  it("paiement tardif après expiration : reprend le stock si disponible → PAID", async () => {
    const { product, order, sessionId } = await pendingOrder();
    await processStripeEvent(makeEvent("checkout.session.expired", { id: sessionId, metadata: { orderId: order.id } }));
    expect(await stockOf(product.id)).toBe(5);

    await processStripeEvent(makeEvent("checkout.session.completed", paidSession(order, sessionId)));

    const after = await loadOrder(order.id);
    expect(after.status).toBe("PAID");
    expect(after.needsReview).toBe(false);
    expect(await stockOf(product.id)).toBe(3);
  });

  it("paiement tardif sans stock : argent encaissé, commande signalée pour vérification manuelle", async () => {
    const { product, order, sessionId } = await pendingOrder();
    await processStripeEvent(makeEvent("checkout.session.expired", { id: sessionId, metadata: { orderId: order.id } }));
    await prisma.product.update({ where: { id: product.id }, data: { stock: 1 } }); // vendu entre-temps

    await processStripeEvent(makeEvent("checkout.session.completed", paidSession(order, sessionId)));

    const after = await loadOrder(order.id);
    expect(after.needsReview).toBe(true);
    expect(after.reviewReason).toBe("OUT_OF_STOCK");
    expect(after.status).toBe("EXPIRED");
    expect(after.payments[0].status).toBe("SUCCEEDED");
    expect(await stockOf(product.id)).toBe(1); // pas de stock négatif
  });
});

describe("webhook : remboursements", () => {
  async function paidOrder() {
    const ctx = await pendingOrder();
    await processStripeEvent(makeEvent("checkout.session.completed", paidSession(ctx.order, ctx.sessionId)));
    return { ...ctx, paymentIntentId: `pi_${ctx.sessionId}` };
  }
  const refund = (id: string, paymentIntent: string, amount: number, status = "succeeded") => ({
    id,
    object: "refund",
    payment_intent: paymentIntent,
    amount,
    currency: "cad",
    status,
    reason: "requested_by_customer",
  });

  it("remboursement partiel → paiement PARTIALLY_REFUNDED, commande toujours PAID", async () => {
    const { order, paymentIntentId } = await paidOrder();
    await processStripeEvent(makeEvent("refund.created", refund("re_1", paymentIntentId, 1000)));

    const after = await loadOrder(order.id);
    expect(after.payments[0]).toMatchObject({ status: "PARTIALLY_REFUNDED", refundedCents: 1000 });
    expect(after.status).toBe("PAID");
    expect(after.refunds).toHaveLength(1);
    expect(after.refunds[0]).toMatchObject({ stripeRefundId: "re_1", amountCents: 1000, status: "SUCCEEDED" });
  });

  it("remboursements successifs jusqu'au total → REFUNDED", async () => {
    const { order, paymentIntentId } = await paidOrder(); // total 3998
    await processStripeEvent(makeEvent("refund.created", refund("re_1", paymentIntentId, 1000)));
    await processStripeEvent(makeEvent("refund.created", refund("re_2", paymentIntentId, 2998)));

    const after = await loadOrder(order.id);
    expect(after.payments[0]).toMatchObject({ status: "REFUNDED", refundedCents: 3998 });
    expect(after.status).toBe("REFUNDED");
  });

  it("un remboursement en attente n'est compté qu'une fois réussi (refund.updated)", async () => {
    const { order, paymentIntentId } = await paidOrder();
    const t = Math.floor(Date.now() / 1000);
    await processStripeEvent(makeEvent("refund.created", refund("re_1", paymentIntentId, 3998, "pending"), { created: t }));
    expect((await loadOrder(order.id)).payments[0].refundedCents).toBe(0);

    await processStripeEvent(makeEvent("refund.updated", refund("re_1", paymentIntentId, 3998, "succeeded"), { created: t + 5 }));
    const after = await loadOrder(order.id);
    expect(after.payments[0].refundedCents).toBe(3998);
    expect(after.status).toBe("REFUNDED");
  });

  it("un remboursement qui échoue ensuite repasse la commande à PAID", async () => {
    const { order, paymentIntentId } = await paidOrder();
    const t = Math.floor(Date.now() / 1000);
    await processStripeEvent(makeEvent("refund.created", refund("re_1", paymentIntentId, 3998), { created: t }));
    expect((await loadOrder(order.id)).status).toBe("REFUNDED");

    await processStripeEvent(makeEvent("refund.failed", refund("re_1", paymentIntentId, 3998, "failed"), { created: t + 5 }));
    const after = await loadOrder(order.id);
    expect(after.status).toBe("PAID");
    expect(after.payments[0]).toMatchObject({ status: "SUCCEEDED", refundedCents: 0 });
  });

  it("ignore un événement de remboursement arrivé dans le désordre", async () => {
    const { order, paymentIntentId } = await paidOrder();
    const t = Math.floor(Date.now() / 1000);
    await processStripeEvent(makeEvent("refund.updated", refund("re_1", paymentIntentId, 1000, "succeeded"), { created: t + 10 }));
    await processStripeEvent(makeEvent("refund.created", refund("re_1", paymentIntentId, 1000, "pending"), { created: t }));

    const after = await loadOrder(order.id);
    expect(after.refunds[0].status).toBe("SUCCEEDED");
    expect(after.payments[0].refundedCents).toBe(1000);
  });

  it("ignore le remboursement d'un paiement inconnu", async () => {
    await paidOrder();
    expect(await processStripeEvent(makeEvent("refund.created", refund("re_x", "pi_someone_else", 500)))).toBe("processed");
    expect(await prisma.refund.count()).toBe(0);
  });
});
