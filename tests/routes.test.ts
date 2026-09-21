import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { GET as cronReconcile } from "@/app/api/cron/reconcile-orders/route";
import { POST as stripeWebhook } from "@/app/api/webhooks/stripe/route";
import { reconcilePendingOrders } from "@/services/reconcile-service";
import { createProduct, makeEvent, paidSession, resetDb, startCheckout } from "./helpers";
import { markFakeSessionPaid, resetStripeMock, stripeMock } from "./stripe-mock";

vi.mock("@/lib/stripe", async () => (await import("./stripe-mock")).stripeModule);

const SECRET = "whsec_test_secret";

beforeEach(async () => {
  await resetDb();
  resetStripeMock();
});

function signedRequest(payload: string, overrides: { secret?: string; header?: string | null } = {}) {
  const header =
    overrides.header === undefined
      ? Stripe.webhooks.generateTestHeaderString({ payload, secret: overrides.secret ?? SECRET })
      : overrides.header;
  return new Request("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    headers: header ? { "stripe-signature": header } : {},
    body: payload,
  });
}

describe("POST /api/webhooks/stripe", () => {
  async function paidPayload() {
    const product = await createProduct();
    const { order, sessionId } = await startCheckout([{ productId: product.id, quantity: 1 }]);
    const event = makeEvent("checkout.session.completed", paidSession(order, sessionId));
    return { order, payload: JSON.stringify(event) };
  }

  it("accepte un événement correctement signé et met la commande à jour", async () => {
    const { order, payload } = await paidPayload();
    const response = await stripeWebhook(signedRequest(payload));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, result: "processed" });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PAID");
  });

  it("répond 200 « duplicate » à une redélivrance", async () => {
    const { payload } = await paidPayload();
    await stripeWebhook(signedRequest(payload));
    const again = await stripeWebhook(signedRequest(payload));
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ received: true, result: "duplicate" });
  });

  it("refuse (400) une signature calculée avec un mauvais secret", async () => {
    const { order, payload } = await paidPayload();
    const response = await stripeWebhook(signedRequest(payload, { secret: "whsec_wrong" }));
    expect(response.status).toBe(400);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING_PAYMENT");
    expect(await prisma.stripeEvent.count()).toBe(0);
  });

  it("refuse (400) un corps modifié après signature", async () => {
    const { order, payload } = await paidPayload();
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
    const tampered = payload.replace('"paid"', '"paid" ');
    const response = await stripeWebhook(signedRequest(tampered, { header }));
    expect(response.status).toBe(400);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING_PAYMENT");
  });

  it("refuse (400) une requête sans en-tête de signature", async () => {
    const { payload } = await paidPayload();
    expect((await stripeWebhook(signedRequest(payload, { header: null }))).status).toBe(400);
  });

  it("renvoie 500 (Stripe réessaiera) si le traitement échoue, sans détail interne", async () => {
    const { payload } = await paidPayload();
    const spy = vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(new Error("connection refused: postgres://user:pw@db"));
    const response = await stripeWebhook(signedRequest(payload));
    spy.mockRestore();
    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Webhook processing failed");
  });
});

describe("réconciliation (filet de sécurité)", () => {
  const expireOrder = (id: string, minutesAgo = 60) =>
    prisma.order.update({ where: { id }, data: { expiresAt: new Date(Date.now() - minutesAgo * 60_000) } });

  it("rattrape un paiement dont le webhook n'est jamais arrivé", async () => {
    const product = await createProduct({ stock: 5 });
    const { order, sessionId } = await startCheckout([{ productId: product.id, quantity: 2 }]);
    markFakeSessionPaid(sessionId);
    await expireOrder(order.id);

    const summary = await reconcilePendingOrders();

    expect(summary).toMatchObject({ checked: 1, paid: 1, released: 0, errors: 0 });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PAID");
  });

  it("expire et libère une commande abandonnée dont la session est encore ouverte", async () => {
    const product = await createProduct({ stock: 5 });
    const { order, sessionId } = await startCheckout([{ productId: product.id, quantity: 2 }]);
    await expireOrder(order.id);

    const summary = await reconcilePendingOrders();

    expect(summary).toMatchObject({ checked: 1, released: 1, paid: 0 });
    expect(stripeMock.checkout.sessions.expire).toHaveBeenCalledWith(sessionId);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("EXPIRED");
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(5);
  });

  it("laisse tranquilles les commandes encore valides ou dans la période de grâce", async () => {
    const product = await createProduct({ stock: 5 });
    const fresh = await startCheckout([{ productId: product.id, quantity: 1 }]);
    const grace = await startCheckout([{ productId: product.id, quantity: 1 }]);
    await expireOrder(grace.order.id, 2); // expirée depuis 2 min < 5 min de grâce

    expect(await reconcilePendingOrders()).toMatchObject({ checked: 0 });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: fresh.order.id } })).status).toBe("PENDING_PAYMENT");
  });

  it("GET /api/cron/reconcile-orders exige le secret", async () => {
    const url = "http://localhost:3000/api/cron/reconcile-orders";
    expect((await cronReconcile(new Request(url))).status).toBe(401);
    expect((await cronReconcile(new Request(url, { headers: { authorization: "Bearer wrong" } }))).status).toBe(401);
    const ok = await cronReconcile(new Request(url, { headers: { authorization: "Bearer cron-test-secret" } }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ checked: 0 });
  });
});
