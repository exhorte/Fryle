import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { computeShippingCents, getShippingConfig } from "@/lib/store-config";
import { processStripeEvent } from "@/services/stripe-webhook-service";
import { createProduct, makeEvent, paidSession, resetDb, startCheckout } from "./helpers";
import { resetStripeMock, stripeMock } from "./stripe-mock";

vi.mock("@/lib/stripe", async () => (await import("./stripe-mock")).stripeModule);

beforeEach(async () => {
  await resetDb();
  resetStripeMock();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const loadOrder = (id: string) => prisma.order.findUniqueOrThrow({ where: { id }, include: { payments: true } });
const createParams = () => stripeMock.checkout.sessions.create.mock.calls[0][0];

describe("configuration livraison / taxes", () => {
  it("est désactivée par défaut", () => {
    expect(getShippingConfig()).toBeNull();
    expect(computeShippingCents(5000, null)).toBe(0);
  });

  it("lit les pays et tarifs depuis l'environnement", () => {
    vi.stubEnv("SHIPPING_COUNTRIES", "ca, us");
    vi.stubEnv("SHIPPING_FLAT_CENTS", "1250");
    vi.stubEnv("FREE_SHIPPING_OVER_CENTS", "10000");
    const config = getShippingConfig();
    expect(config).toEqual({ countries: ["CA", "US"], flatCents: 1250, freeOverCents: 10000 });
    expect(computeShippingCents(9999, config)).toBe(1250);
    expect(computeShippingCents(10000, config)).toBe(0);
  });

  it.each([
    ["SHIPPING_COUNTRIES", "Canada"],
    ["SHIPPING_FLAT_CENTS", "9.99"],
    ["SHIPPING_FLAT_CENTS", "-5"],
  ])("rejette une valeur invalide (%s=%s)", (name, value) => {
    vi.stubEnv("SHIPPING_COUNTRIES", "CA");
    vi.stubEnv(name, value);
    expect(() => getShippingConfig()).toThrow();
  });
});

describe("livraison", () => {
  beforeEach(() => {
    vi.stubEnv("SHIPPING_COUNTRIES", "CA,US");
    vi.stubEnv("SHIPPING_FLAT_CENTS", "999");
  });

  it("ajoute les frais côté serveur et demande l'adresse à Stripe", async () => {
    const product = await createProduct({ priceCents: 1999 });
    const { order } = await startCheckout([{ productId: product.id, quantity: 2 }]);

    expect(order).toMatchObject({ subtotalCents: 3998, shippingCents: 999, totalCents: 4997, taxCents: 0 });
    const params = createParams();
    expect(params.shipping_address_collection).toEqual({ allowed_countries: ["CA", "US"] });
    expect(params.shipping_options).toEqual([
      {
        shipping_rate_data: expect.objectContaining({
          type: "fixed_amount",
          display_name: "Standard shipping",
          fixed_amount: { amount: 999, currency: "cad" },
        }),
      },
    ]);
    expect(order.payments[0].amountCents).toBe(4997);
  });

  it("offre la livraison au-delà du seuil", async () => {
    vi.stubEnv("FREE_SHIPPING_OVER_CENTS", "3000");
    const product = await createProduct({ priceCents: 1999 });
    const { order } = await startCheckout([{ productId: product.id, quantity: 2 }]);

    expect(order.shippingCents).toBe(0);
    expect(order.totalCents).toBe(3998);
    expect(createParams().shipping_options?.[0].shipping_rate_data?.display_name).toBe("Free shipping");
  });

  it("enregistre le client et l'adresse d'expédition confirmés au paiement", async () => {
    const product = await createProduct({ priceCents: 1999 });
    const { order, sessionId } = await startCheckout([{ productId: product.id, quantity: 1 }]);

    await processStripeEvent(
      makeEvent(
        "checkout.session.completed",
        paidSession(order, sessionId, { email: "jane@example.com", shippingTo: { name: "Jane Doe", country: "CA" } }),
      ),
    );

    const after = await loadOrder(order.id);
    expect(after.status).toBe("PAID");
    expect(after.totalCents).toBe(2998);
    expect(after).toMatchObject({ customerEmail: "jane@example.com", shippingName: "Jane Doe" });
    expect(after.shippingAddress).toMatchObject({ line1: "1 Main St", country: "CA", postal_code: "H2X 1Y4" });
  });

  it("signale un paiement dont les frais de livraison ne correspondent pas", async () => {
    const product = await createProduct();
    const { order, sessionId } = await startCheckout([{ productId: product.id, quantity: 1 }]);
    const session = paidSession(order, sessionId);
    session.total_details.amount_shipping = 0;
    session.amount_total = order.subtotalCents;

    await processStripeEvent(makeEvent("checkout.session.completed", session));

    const after = await loadOrder(order.id);
    expect(after.status).toBe("PENDING_PAYMENT");
    expect(after.reviewReason).toBe("AMOUNT_MISMATCH");
  });
});

describe("taxes (Stripe Tax)", () => {
  it("n'est pas activé par défaut : aucun paramètre de taxe envoyé", async () => {
    const product = await createProduct();
    await startCheckout([{ productId: product.id, quantity: 1 }]);
    expect(createParams().automatic_tax).toBeUndefined();
    expect(createParams().line_items?.[0].price_data?.tax_behavior).toBeUndefined();
  });

  it("STRIPE_AUTOMATIC_TAX=true active le calcul et déclare les prix hors taxes", async () => {
    vi.stubEnv("STRIPE_AUTOMATIC_TAX", "true");
    const product = await createProduct();
    await startCheckout([{ productId: product.id, quantity: 1 }]);
    expect(createParams().automatic_tax).toEqual({ enabled: true });
    expect(createParams().line_items?.[0].price_data?.tax_behavior).toBe("exclusive");
  });

  it("enregistre les taxes calculées par Stripe et le total réellement encaissé", async () => {
    vi.stubEnv("STRIPE_AUTOMATIC_TAX", "true");
    vi.stubEnv("SHIPPING_COUNTRIES", "CA");
    vi.stubEnv("SHIPPING_FLAT_CENTS", "500");
    const product = await createProduct({ priceCents: 2000 });
    const { order, sessionId } = await startCheckout([{ productId: product.id, quantity: 1 }]);
    expect(order.totalCents).toBe(2500); // avant taxes

    await processStripeEvent(makeEvent("checkout.session.completed", paidSession(order, sessionId, { tax: 375 })));

    const after = await loadOrder(order.id);
    expect(after.status).toBe("PAID");
    expect(after).toMatchObject({ subtotalCents: 2000, shippingCents: 500, taxCents: 375, totalCents: 2875 });
    expect(after.payments[0].amountCents).toBe(2875);
  });

  it("refuse des taxes que la boutique n'a pas activées", async () => {
    const product = await createProduct();
    const { order, sessionId } = await startCheckout([{ productId: product.id, quantity: 1 }]);

    await processStripeEvent(makeEvent("checkout.session.completed", paidSession(order, sessionId, { tax: 300 })));

    const after = await loadOrder(order.id);
    expect(after.status).toBe("PENDING_PAYMENT");
    expect(after.reviewReason).toBe("AMOUNT_MISMATCH");
  });

  it("refuse une remise que la boutique n'a pas accordée", async () => {
    const product = await createProduct({ priceCents: 2000 });
    const { order, sessionId } = await startCheckout([{ productId: product.id, quantity: 1 }]);

    await processStripeEvent(makeEvent("checkout.session.completed", paidSession(order, sessionId, { discount: 500 })));

    expect((await loadOrder(order.id)).reviewReason).toBe("AMOUNT_MISMATCH");
  });
});
