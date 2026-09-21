import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { createCheckoutSession, type CheckoutContext } from "@/services/checkout-service";

export async function resetDb() {
  // Garde-fou : ne jamais vider une base qui n'est pas la base de test.
  const [{ current_database }] = await prisma.$queryRaw<{ current_database: string }[]>`SELECT current_database()`;
  if (!current_database.endsWith("_test")) throw new Error(`Refusing to truncate "${current_database}"`);
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Refund","Payment","OrderItem","Order","StripeEvent","Product","RateLimit","Session","Account","Verification","User" RESTART IDENTITY CASCADE',
  );
}

export function createProduct(overrides: Partial<Parameters<typeof prisma.product.create>[0]["data"]> = {}) {
  return prisma.product.create({
    data: { name: "Widget", priceCents: 1999, currency: "cad", stock: 5, ...overrides },
  });
}

/** Lance un vrai checkout (Stripe simulé) et renvoie la commande créée. */
export async function startCheckout(
  items: { productId: string; quantity: number }[],
  cartId = randomUUID(),
  context: CheckoutContext = {},
) {
  const { url } = await createCheckoutSession({ cartId, items }, context);
  const order = await prisma.order.findFirstOrThrow({
    where: { cartId },
    orderBy: { createdAt: "desc" },
    include: { payments: true, items: true },
  });
  return { url, cartId, order, sessionId: order.payments[0].stripeCheckoutSessionId! };
}

let eventCounter = 0;

export function makeEvent<T extends Stripe.Event["type"]>(
  type: T,
  object: unknown,
  options: { id?: string; created?: number } = {},
): Stripe.Event {
  return {
    id: options.id ?? `evt_test_${++eventCounter}_${randomUUID()}`,
    object: "event",
    type,
    created: options.created ?? Math.floor(Date.now() / 1000),
    data: { object },
  } as unknown as Stripe.Event;
}

type PaidOrder = { id: string; subtotalCents: number; shippingCents: number; currency: string };

/** Session Checkout payée, telle que Stripe l'enverrait (total = sous-total + livraison + taxes). */
export function paidSession(
  order: PaidOrder,
  sessionId: string,
  extra: { tax?: number; discount?: number; email?: string; shippingTo?: { name: string; country: string } } = {},
) {
  const tax = extra.tax ?? 0;
  const discount = extra.discount ?? 0;
  return {
    id: sessionId,
    payment_status: "paid",
    amount_total: order.subtotalCents + order.shippingCents + tax - discount,
    currency: order.currency,
    payment_intent: `pi_${sessionId}`,
    metadata: { orderId: order.id },
    total_details: { amount_shipping: order.shippingCents, amount_tax: tax, amount_discount: discount },
    customer_details: { email: extra.email ?? "buyer@example.com" },
    collected_information: extra.shippingTo
      ? {
          shipping_details: {
            name: extra.shippingTo.name,
            address: { line1: "1 Main St", city: "Montréal", state: "QC", postal_code: "H2X 1Y4", country: extra.shippingTo.country },
          },
        }
      : null,
  };
}
