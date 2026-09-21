import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as stripeWebhook } from "@/app/api/webhooks/stripe/route";
import { prisma } from "@/lib/db";
import { refundUnfulfillableOrders } from "@/services/auto-refund-service";
import { getOrderStatusBySessionId } from "@/services/order-service";
import { processStripeEvent } from "@/services/stripe-webhook-service";
import { createProduct, makeEvent, paidSession, resetDb, startCheckout } from "./helpers";
import { resetStripeMock, stripeMock } from "./stripe-mock";

vi.mock("@/lib/stripe", async () => (await import("./stripe-mock")).stripeModule);

beforeEach(async () => {
  await resetDb();
  resetStripeMock();
});

const loadOrder = (id: string) =>
  prisma.order.findUniqueOrThrow({ where: { id }, include: { payments: true, refunds: true } });

/** Commande expirée dont le stock a été vendu ailleurs, puis payée tardivement → à rembourser. */
async function unfulfillableOrder() {
  const product = await createProduct({ stock: 5 });
  const checkout = await startCheckout([{ productId: product.id, quantity: 2 }]);
  const { order, sessionId } = checkout;

  await processStripeEvent(makeEvent("checkout.session.expired", { id: sessionId, metadata: { orderId: order.id } }));
  await prisma.product.update({ where: { id: product.id }, data: { stock: 1 } });
  const paid = paidSession(order, sessionId);
  await processStripeEvent(makeEvent("checkout.session.completed", paid));
  return { ...checkout, paymentIntentId: paid.payment_intent };
}

describe("remboursement automatique d'une commande impossible à honorer", () => {
  it("rembourse intégralement le paiement, avec une clé d'idempotence liée à la commande", async () => {
    const { order, paymentIntentId } = await unfulfillableOrder();
    expect((await loadOrder(order.id)).reviewReason).toBe("OUT_OF_STOCK");

    const summary = await refundUnfulfillableOrders();

    expect(summary).toEqual({ attempted: 1, refunded: 1, errors: 0 });
    expect(stripeMock.refunds.create).toHaveBeenCalledTimes(1);
    expect(stripeMock.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: paymentIntentId, metadata: expect.objectContaining({ orderId: order.id }) }),
      { idempotencyKey: `auto-refund-${order.id}` },
    );
  });

  it("le webhook refund.created clôt ensuite le dossier : paiement remboursé, plus de vérification", async () => {
    const { order, sessionId, paymentIntentId } = await unfulfillableOrder();
    await refundUnfulfillableOrders();

    await processStripeEvent(
      makeEvent("refund.created", {
        id: "re_1",
        payment_intent: paymentIntentId,
        amount: order.totalCents,
        currency: "cad",
        status: "succeeded",
        reason: null,
      }),
    );

    const after = await loadOrder(order.id);
    expect(after.payments[0]).toMatchObject({ status: "REFUNDED", refundedCents: order.totalCents });
    expect(after.needsReview).toBe(false);
    expect(after.status).toBe("EXPIRED"); // la commande n'a jamais été honorée
    expect(await getOrderStatusBySessionId(sessionId)).toEqual({ state: "refunded" });
  });

  it("ne rembourse jamais deux fois : ni après une première demande, ni si un remboursement existe déjà", async () => {
    const { order, paymentIntentId } = await unfulfillableOrder();
    await refundUnfulfillableOrders();
    await processStripeEvent(
      makeEvent("refund.created", {
        id: "re_1",
        payment_intent: paymentIntentId,
        amount: 100, // remboursement partiel encore en cours de traitement : la commande reste à vérifier
        currency: "cad",
        status: "pending",
        reason: null,
      }),
    );

    const again = await refundUnfulfillableOrders();

    expect(again.attempted).toBe(0);
    expect(stripeMock.refunds.create).toHaveBeenCalledTimes(1);
    expect((await loadOrder(order.id)).needsReview).toBe(true);
  });

  it("laisse à vérification manuelle un écart de montant (pas de remboursement automatique)", async () => {
    const product = await createProduct();
    const { order, sessionId } = await startCheckout([{ productId: product.id, quantity: 1 }]);
    await processStripeEvent(
      makeEvent("checkout.session.completed", { ...paidSession(order, sessionId), amount_total: 1 }),
    );

    expect((await refundUnfulfillableOrders()).attempted).toBe(0);
    expect(stripeMock.refunds.create).not.toHaveBeenCalled();
    expect((await loadOrder(order.id)).reviewReason).toBe("AMOUNT_MISMATCH");
  });

  it("ne rembourse pas une commande normalement payée", async () => {
    const product = await createProduct();
    const { order, sessionId } = await startCheckout([{ productId: product.id, quantity: 1 }]);
    await processStripeEvent(makeEvent("checkout.session.completed", paidSession(order, sessionId)));

    expect((await refundUnfulfillableOrders()).attempted).toBe(0);
  });

  it("si Stripe échoue, la commande reste signalée et la tentative suivante réussit", async () => {
    const { order } = await unfulfillableOrder();
    stripeMock.refunds.create.mockRejectedValueOnce(new Error("Stripe unavailable"));

    expect(await refundUnfulfillableOrders()).toEqual({ attempted: 1, refunded: 0, errors: 1 });
    expect((await loadOrder(order.id)).needsReview).toBe(true);

    expect(await refundUnfulfillableOrders()).toEqual({ attempted: 1, refunded: 1, errors: 0 });
  });

  it("est déclenché juste après le webhook de paiement", async () => {
    const product = await createProduct({ stock: 5 });
    const { order, sessionId } = await startCheckout([{ productId: product.id, quantity: 2 }]);
    await processStripeEvent(makeEvent("checkout.session.expired", { id: sessionId, metadata: { orderId: order.id } }));
    await prisma.product.update({ where: { id: product.id }, data: { stock: 1 } });

    const event = makeEvent("checkout.session.completed", paidSession(order, sessionId));
    const payload = JSON.stringify(event);
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_test_secret" });
    const response = await stripeWebhook(
      new Request("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": header },
        body: payload,
      }),
    );

    expect(response.status).toBe(200);
    expect(stripeMock.refunds.create).toHaveBeenCalledTimes(1);
  });

  it("un échec du remboursement n'empêche pas le webhook de répondre 200 (la réconciliation reprendra)", async () => {
    const product = await createProduct({ stock: 5 });
    const { order, sessionId } = await startCheckout([{ productId: product.id, quantity: 2 }]);
    await processStripeEvent(makeEvent("checkout.session.expired", { id: sessionId, metadata: { orderId: order.id } }));
    await prisma.product.update({ where: { id: product.id }, data: { stock: 1 } });
    stripeMock.refunds.create.mockRejectedValueOnce(new Error("Stripe unavailable"));

    const payload = JSON.stringify(makeEvent("checkout.session.completed", paidSession(order, sessionId)));
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_test_secret" });
    const response = await stripeWebhook(
      new Request("http://localhost:3000/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": header },
        body: payload,
      }),
    );

    expect(response.status).toBe(200);
    expect((await loadOrder(order.id)).needsReview).toBe(true);
  });
});
