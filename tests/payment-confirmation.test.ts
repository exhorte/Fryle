import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { syncCheckoutSessionFromStripe } from "@/services/payment-confirmation-service";
import { getOrderStatusBySessionId } from "@/services/order-service";
import { processStripeEvent } from "@/services/stripe-webhook-service";
import { createProduct, makeEvent, paidSession, resetDb, startCheckout } from "./helpers";
import { markFakeSessionPaid, resetStripeMock, stripeMock } from "./stripe-mock";

vi.mock("@/lib/stripe", async () => (await import("./stripe-mock")).stripeModule);

beforeEach(async () => {
  await resetDb();
  resetStripeMock();
});

const loadOrder = (id: string) => prisma.order.findUniqueOrThrow({ where: { id }, include: { payments: true } });
const stockOf = async (id: string) => (await prisma.product.findUniqueOrThrow({ where: { id } })).stock;

async function pendingOrder() {
  const product = await createProduct({ stock: 5 });
  const checkout = await startCheckout([{ productId: product.id, quantity: 2 }]);
  return { product, ...checkout };
}

/** Rend la session simulée conforme à ce que Stripe renverrait après paiement. */
function payFakeSession(order: Awaited<ReturnType<typeof pendingOrder>>["order"], sessionId: string) {
  const session = markFakeSessionPaid(sessionId);
  Object.assign(session, paidSession(order, sessionId), { status: "complete" });
}

describe("page de succès : vérification directe auprès de Stripe", () => {
  it("valide une commande payée dont le webhook n'est pas (encore) arrivé", async () => {
    const { order, sessionId } = await pendingOrder();
    payFakeSession(order, sessionId);

    expect(await syncCheckoutSessionFromStripe(sessionId)).toBe("paid");

    const after = await loadOrder(order.id);
    expect(after.status).toBe("PAID");
    expect(after.payments[0].status).toBe("SUCCEEDED");
    expect(await getOrderStatusBySessionId(sessionId)).toMatchObject({ state: "paid" });
  });

  it("le webhook arrivé ensuite ne refait rien (pas de double traitement)", async () => {
    const { product, order, sessionId } = await pendingOrder();
    payFakeSession(order, sessionId);
    await syncCheckoutSessionFromStripe(sessionId);

    await processStripeEvent(makeEvent("checkout.session.completed", paidSession(order, sessionId)));

    expect((await loadOrder(order.id)).status).toBe("PAID");
    expect(await stockOf(product.id)).toBe(3);
  });

  it("n'interroge pas Stripe pour une session inconnue", async () => {
    expect(await syncCheckoutSessionFromStripe("cs_test_unknown")).toBe("skipped");
    expect(stripeMock.checkout.sessions.retrieve).not.toHaveBeenCalled();
  });

  it("n'interroge pas Stripe quand la commande est déjà traitée", async () => {
    const { order, sessionId } = await pendingOrder();
    await processStripeEvent(makeEvent("checkout.session.completed", paidSession(order, sessionId)));
    stripeMock.checkout.sessions.retrieve.mockClear();

    expect(await syncCheckoutSessionFromStripe(sessionId)).toBe("skipped");
    expect(stripeMock.checkout.sessions.retrieve).not.toHaveBeenCalled();
  });

  it("applique la même vérification de montant que le webhook", async () => {
    const { order, sessionId } = await pendingOrder();
    payFakeSession(order, sessionId);
    const session = await stripeMock.checkout.sessions.retrieve(sessionId);
    Object.assign(session!, { amount_total: 1 });

    await syncCheckoutSessionFromStripe(sessionId);

    const after = await loadOrder(order.id);
    expect(after.status).toBe("PENDING_PAYMENT");
    expect(after.reviewReason).toBe("AMOUNT_MISMATCH");
  });

  it("laisse la commande en attente tant que la session n'est pas payée", async () => {
    const { order, sessionId } = await pendingOrder();
    expect(await syncCheckoutSessionFromStripe(sessionId)).toBe("open");
    expect((await loadOrder(order.id)).status).toBe("PENDING_PAYMENT");
  });

  it("paiement asynchrone en cours : paiement PROCESSING", async () => {
    const { order, sessionId } = await pendingOrder();
    const session = await stripeMock.checkout.sessions.retrieve(sessionId);
    Object.assign(session!, { status: "complete", payment_status: "unpaid" });

    expect(await syncCheckoutSessionFromStripe(sessionId)).toBe("processing");
    expect((await loadOrder(order.id)).payments[0].status).toBe("PROCESSING");
  });

  it("session expirée : commande EXPIRED et stock restitué", async () => {
    const { product, order, sessionId } = await pendingOrder();
    await stripeMock.checkout.sessions.expire(sessionId);

    expect(await syncCheckoutSessionFromStripe(sessionId)).toBe("expired");
    expect((await loadOrder(order.id)).status).toBe("EXPIRED");
    expect(await stockOf(product.id)).toBe(5);
  });

  it("Stripe indisponible : aucune erreur remontée, la commande reste en attente", async () => {
    const { order, sessionId } = await pendingOrder();
    stripeMock.checkout.sessions.retrieve.mockRejectedValueOnce(new Error("Stripe down"));

    expect(await syncCheckoutSessionFromStripe(sessionId)).toBe("error");
    expect((await loadOrder(order.id)).status).toBe("PENDING_PAYMENT");
  });
});
