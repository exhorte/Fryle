import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { CheckoutError, createCheckoutSession } from "@/services/checkout-service";
import { createProduct, resetDb, startCheckout } from "./helpers";
import { resetStripeMock, stripeMock } from "./stripe-mock";

vi.mock("@/lib/stripe", async () => (await import("./stripe-mock")).stripeModule);

beforeEach(async () => {
  await resetDb();
  resetStripeMock();
});

async function expectCheckoutError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ name: "CheckoutError", code });
}

describe("checkout : le serveur est la seule source de vérité", () => {
  it("calcule le total et les lignes depuis la base, pas depuis le client", async () => {
    const product = await createProduct({ priceCents: 1999, stock: 5 });

    // Un client malveillant ajoute price/total/currency : ces champs doivent être ignorés.
    const { url } = await createCheckoutSession({
      cartId: randomUUID(),
      items: [{ productId: product.id, quantity: 2, price: 1, total: 1, currency: "usd" }],
      total: 1,
    });

    expect(url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
    const params = stripeMock.checkout.sessions.create.mock.calls[0][0];
    expect(params.line_items).toEqual([
      expect.objectContaining({
        quantity: 2,
        price_data: expect.objectContaining({ currency: "cad", unit_amount: 1999 }),
      }),
    ]);
    expect(params.mode).toBe("payment");

    const order = await prisma.order.findFirstOrThrow({ include: { items: true, payments: true } });
    expect(order.totalCents).toBe(3998);
    expect(order.currency).toBe("cad");
    expect(order.status).toBe("PENDING_PAYMENT");
    expect(order.items[0]).toMatchObject({ unitPriceCents: 1999, quantity: 2, totalCents: 3998, productName: "Widget" });
    expect(order.payments[0]).toMatchObject({ amountCents: 3998, status: "PENDING" });
  });

  it("relie la session Stripe à la commande (metadata, client_reference_id, idempotence)", async () => {
    const product = await createProduct();
    const { order, sessionId } = await startCheckout([{ productId: product.id, quantity: 1 }]);

    const [params, options] = stripeMock.checkout.sessions.create.mock.calls[0];
    expect(params.metadata).toEqual({ orderId: order.id });
    expect(params.client_reference_id).toBe(order.id);
    expect(params.success_url).toContain("/success?session_id={CHECKOUT_SESSION_ID}");
    expect(options).toEqual({ idempotencyKey: `checkout-session-${order.id}` });
    expect(order.payments[0].stripeCheckoutSessionId).toBe(sessionId);
  });

  it("réserve le stock au checkout", async () => {
    const product = await createProduct({ stock: 5 });
    await startCheckout([{ productId: product.id, quantity: 2 }]);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(3);
  });

  it("fusionne les lignes dupliquées d'un même produit", async () => {
    const product = await createProduct({ stock: 5 });
    const { order } = await startCheckout([
      { productId: product.id, quantity: 2 },
      { productId: product.id, quantity: 3 },
    ]);
    expect(order.items).toHaveLength(1);
    expect(order.items[0].quantity).toBe(5);
  });
});

describe("checkout : validation", () => {
  it.each([
    ["quantité 0", { quantity: 0 }],
    ["quantité négative", { quantity: -1 }],
    ["quantité décimale", { quantity: 1.5 }],
    ["quantité au-delà du maximum", { quantity: 11 }],
    ["quantité en texte", { quantity: "2" }],
  ])("refuse une %s", async (_label, override) => {
    const product = await createProduct();
    const item: Record<string, unknown> = { productId: product.id, ...override };
    await expectCheckoutError(createCheckoutSession({ cartId: randomUUID(), items: [item] }), "INVALID_CART");
    expect(await prisma.order.count()).toBe(0);
  });

  it("refuse un panier vide ou un cartId invalide", async () => {
    const product = await createProduct();
    await expectCheckoutError(createCheckoutSession({ cartId: randomUUID(), items: [] }), "INVALID_CART");
    await expectCheckoutError(
      createCheckoutSession({ cartId: "not-a-uuid", items: [{ productId: product.id, quantity: 1 }] }),
      "INVALID_CART",
    );
    await expectCheckoutError(createCheckoutSession(null), "INVALID_CART");
  });

  it("refuse une quantité cumulée trop grande après fusion des lignes", async () => {
    const product = await createProduct({ stock: 100 });
    await expectCheckoutError(
      createCheckoutSession({
        cartId: randomUUID(),
        items: [
          { productId: product.id, quantity: 8 },
          { productId: product.id, quantity: 8 },
        ],
      }),
      "INVALID_CART",
    );
  });

  it("refuse un produit inconnu", async () => {
    await expectCheckoutError(
      createCheckoutSession({ cartId: randomUUID(), items: [{ productId: "nope", quantity: 1 }] }),
      "PRODUCT_UNAVAILABLE",
    );
  });

  it("refuse un produit inactif", async () => {
    const product = await createProduct({ active: false });
    await expectCheckoutError(
      createCheckoutSession({ cartId: randomUUID(), items: [{ productId: product.id, quantity: 1 }] }),
      "PRODUCT_UNAVAILABLE",
    );
  });

  it("refuse un stock insuffisant sans créer de commande ni toucher au stock", async () => {
    const a = await createProduct({ name: "A", stock: 5 });
    const b = await createProduct({ name: "B", stock: 1 });
    await expectCheckoutError(
      createCheckoutSession({
        cartId: randomUUID(),
        items: [
          { productId: a.id, quantity: 2 },
          { productId: b.id, quantity: 2 },
        ],
      }),
      "OUT_OF_STOCK",
    );
    expect(await prisma.order.count()).toBe(0);
    // tout ou rien : la réservation de A est annulée avec celle de B
    expect((await prisma.product.findUniqueOrThrow({ where: { id: a.id } })).stock).toBe(5);
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("refuse un panier mélangeant plusieurs devises", async () => {
    const cad = await createProduct({ currency: "cad" });
    const usd = await createProduct({ currency: "usd" });
    await expectCheckoutError(
      createCheckoutSession({
        cartId: randomUUID(),
        items: [
          { productId: cad.id, quantity: 1 },
          { productId: usd.id, quantity: 1 },
        ],
      }),
      "CURRENCY_MISMATCH",
    );
  });

  it("refuse une devise non supportée", async () => {
    const product = await createProduct({ currency: "xxx" });
    await expectCheckoutError(
      createCheckoutSession({ cartId: randomUUID(), items: [{ productId: product.id, quantity: 1 }] }),
      "CURRENCY_MISMATCH",
    );
  });
});

describe("checkout : concurrence et doublons", () => {
  it("ne survend pas : 8 checkouts simultanés sur 3 unités → exactement 3 réussissent", async () => {
    const product = await createProduct({ stock: 3 });
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        createCheckoutSession({ cartId: randomUUID(), items: [{ productId: product.id, quantity: 1 }] }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(failures.every((f) => f.reason instanceof CheckoutError && f.reason.code === "OUT_OF_STOCK")).toBe(true);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(0);
    expect(await prisma.order.count()).toBe(3);
  });

  it("un double clic simultané sur le même panier ne crée qu'une commande et une réservation", async () => {
    const product = await createProduct({ stock: 5 });
    const cartId = randomUUID();
    const payload = { cartId, items: [{ productId: product.id, quantity: 2 }] };

    await Promise.allSettled([createCheckoutSession(payload), createCheckoutSession(payload)]);

    expect(await prisma.order.count({ where: { cartId } })).toBe(1);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(3);
    expect(stripeMock.checkout.sessions.create).toHaveBeenCalledTimes(1);
  });

  it("réutilise la session ouverte quand le même panier est soumis à nouveau", async () => {
    const product = await createProduct({ stock: 5 });
    const first = await startCheckout([{ productId: product.id, quantity: 2 }]);
    const second = await createCheckoutSession({ cartId: first.cartId, items: [{ productId: product.id, quantity: 2 }] });

    expect(second.url).toBe(first.url);
    expect(stripeMock.checkout.sessions.create).toHaveBeenCalledTimes(1);
    expect(await prisma.order.count()).toBe(1);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(3);
  });

  it("annule l'ancienne commande et expire son ancienne session quand le panier change", async () => {
    const product = await createProduct({ stock: 5 });
    const first = await startCheckout([{ productId: product.id, quantity: 2 }]);
    const second = await startCheckout([{ productId: product.id, quantity: 3 }], first.cartId);

    expect(second.sessionId).not.toBe(first.sessionId);
    expect(stripeMock.checkout.sessions.expire).toHaveBeenCalledWith(first.sessionId);
    const old = await prisma.order.findUniqueOrThrow({ where: { id: first.order.id }, include: { payments: true } });
    expect(old.status).toBe("CANCELED");
    expect(old.payments[0].status).toBe("CANCELED");
    // 5 - 3 réservés par la nouvelle commande ; les 2 de l'ancienne ont été restitués
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(2);
  });

  it("libère la réservation si Stripe échoue, et renvoie une erreur sûre", async () => {
    const product = await createProduct({ stock: 5 });
    stripeMock.checkout.sessions.create.mockRejectedValueOnce(new Error("Stripe is down: sk_test_secret_leak"));

    const attempt = createCheckoutSession({ cartId: randomUUID(), items: [{ productId: product.id, quantity: 2 }] });
    await expect(attempt).rejects.toMatchObject({ code: "PAYMENT_UNAVAILABLE", message: "Impossible de lancer le paiement. Veuillez réessayer." });

    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(5);
    expect((await prisma.order.findFirstOrThrow()).status).toBe("CANCELED");
  });
});
