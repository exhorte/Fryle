import Stripe from "stripe";
import { vi } from "vitest";

// Faux client Stripe : les appels réseau sont simulés, mais `webhooks` est le vrai code du SDK,
// donc la vérification de signature testée est la vraie.
type FakeSession = Record<string, unknown> & { id: string; status: string };
const sessions = new Map<string, FakeSession>();
let counter = 0;

const realWebhooks = new Stripe("sk_test_dummy").webhooks;

export const stripeMock = {
  checkout: {
    sessions: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- options only inspected via mock.calls
      create: vi.fn(async (params: Stripe.Checkout.SessionCreateParams, ..._options: [Stripe.RequestOptions?]) => {
        const id = `cs_test_${++counter}`;
        const items = params.line_items ?? [];
        const subtotal = items.reduce((sum, i) => sum + (i.price_data?.unit_amount ?? 0) * (i.quantity ?? 0), 0);
        const shipping = params.shipping_options?.[0]?.shipping_rate_data?.fixed_amount?.amount ?? 0;
        const session: FakeSession = {
          id,
          url: `https://checkout.stripe.com/c/pay/${id}`,
          status: "open",
          payment_status: "unpaid",
          amount_subtotal: subtotal,
          amount_total: subtotal + shipping,
          total_details: { amount_shipping: shipping, amount_tax: 0, amount_discount: 0 },
          currency: items[0]?.price_data?.currency,
          metadata: params.metadata,
          payment_intent: null,
        };
        sessions.set(id, session);
        return session;
      }),
      retrieve: vi.fn(async (id: string) => sessions.get(id)),
      expire: vi.fn(async (id: string) => {
        const session = sessions.get(id);
        if (session) session.status = "expired";
        return session;
      }),
    },
  },
  refunds: {
    create: vi.fn(async () => ({ id: `re_auto_${++counter}` })),
  },
  webhooks: realWebhooks,
};

export const stripeModule = { getStripe: () => stripeMock };

export function resetStripeMock() {
  sessions.clear();
  stripeMock.checkout.sessions.create.mockClear();
  stripeMock.checkout.sessions.retrieve.mockClear();
  stripeMock.checkout.sessions.expire.mockClear();
  stripeMock.refunds.create.mockClear();
}

/** Simule un paiement réussi côté Stripe. */
export function markFakeSessionPaid(id: string, paymentIntentId = `pi_${id}`) {
  const session = sessions.get(id);
  if (!session) throw new Error(`Unknown fake session ${id}`);
  Object.assign(session, { status: "complete", payment_status: "paid", payment_intent: paymentIntentId });
  return session;
}
