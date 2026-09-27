import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getBaseUrl } from "@/lib/env";
import { log } from "@/lib/log";
import { MAX_LINES, MAX_QUANTITY_PER_PRODUCT } from "@/lib/limits";
import { isSupportedCurrency } from "@/lib/money";
import { computeShippingCents, getShippingConfig, isAutomaticTaxEnabled, type ShippingConfig } from "@/lib/store-config";
import { getStripe } from "@/lib/stripe";
import { releaseOrder, tryReserveStock } from "./order-service";

// Stripe exige au moins 30 minutes ; marge pour le décalage d'horloge.
const SESSION_TTL_SECONDS = 31 * 60;

/** Le client n'envoie QUE des identifiants et des quantités : jamais de prix, total, devise ni stock. */
export const checkoutInputSchema = z.object({
  cartId: z.uuid(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1).max(64),
        quantity: z.number().int().min(1).max(MAX_QUANTITY_PER_PRODUCT),
      }),
    )
    .min(1)
    .max(MAX_LINES),
});

export type CheckoutErrorCode =
  | "INVALID_CART"
  | "PRODUCT_UNAVAILABLE"
  | "OUT_OF_STOCK"
  | "CURRENCY_MISMATCH"
  | "IN_PROGRESS"
  | "PAYMENT_UNAVAILABLE";

/** Erreur dont le message peut être affiché tel quel au client. */
export class CheckoutError extends Error {
  constructor(
    public readonly code: CheckoutErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

type Line = { productId: string; quantity: number };

/** Identité résolue côté serveur (session), jamais lue depuis le formulaire. */
export type CheckoutContext = { userId?: string | null; email?: string | null };

function normalizeLines(items: Line[]): Line[] {
  const merged = new Map<string, number>();
  for (const item of items) merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.quantity);
  const lines = [...merged].map(([productId, quantity]) => ({ productId, quantity }));
  if (lines.some((l) => l.quantity > MAX_QUANTITY_PER_PRODUCT)) {
    throw new CheckoutError("INVALID_CART", `Vous pouvez acheter au maximum ${MAX_QUANTITY_PER_PRODUCT} unités d'un même produit.`);
  }
  return lines.sort((a, b) => a.productId.localeCompare(b.productId));
}

function fingerprint(lines: Line[]): string {
  return createHash("sha256")
    .update(lines.map((l) => `${l.productId}:${l.quantity}`).join("|"))
    .digest("hex");
}

type Plan =
  | { kind: "reuse"; orderId: string; sessionId: string }
  | {
      kind: "new";
      orderId: string;
      paymentId: string;
      currency: string;
      expiresAt: Date;
      shippingCents: number;
      items: { name: string; unitPriceCents: number; quantity: number; imageUrl: string | null }[];
      supersededSessionId: string | null;
    };

/**
 * Phase 1 (transaction) : valide le panier depuis la base, réserve le stock et crée la commande.
 * Le verrou consultatif sérialise les checkouts d'un même panier (double clic, deux onglets).
 */
async function planOrder(
  cartId: string,
  lines: Line[],
  userId: string | null,
  shippingConfig: ShippingConfig | null,
): Promise<Plan> {
  const fp = fingerprint(lines);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${cartId}))`;

    let supersededSessionId: string | null = null;
    const open = await tx.order.findFirst({
      where: { cartId, status: "PENDING_PAYMENT" },
      include: { payments: true },
    });
    if (open) {
      const sessionId = open.payments[0]?.stripeCheckoutSessionId ?? null;
      const live = open.expiresAt > new Date();
      // Réutilisable seulement pour le même panier, encore valide, et le même utilisateur (ou une commande invité).
      if (open.itemsFingerprint === fp && live && (open.userId === null || open.userId === userId)) {
        if (!sessionId) throw new CheckoutError("IN_PROGRESS", "Votre paiement est déjà en cours de préparation. Réessayez dans un instant.");
        if (open.userId === null && userId) {
          await tx.order.update({ where: { id: open.id }, data: { userId } });
        }
        return { kind: "reuse", orderId: open.id, sessionId };
      }
      // Panier modifié ou réservation périmée : on libère l'ancienne commande avant d'en créer une nouvelle.
      await releaseOrder(tx, open.id, live ? "CANCELED" : "EXPIRED");
      supersededSessionId = sessionId;
    }

    const products = await tx.product.findMany({ where: { id: { in: lines.map((l) => l.productId) } } });
    const byId = new Map(products.map((p) => [p.id, p]));
    for (const line of lines) {
      const product = byId.get(line.productId);
      if (!product || !product.active) {
        throw new CheckoutError("PRODUCT_UNAVAILABLE", "Un produit de votre panier n'est plus disponible.");
      }
    }

    const currency = byId.get(lines[0].productId)!.currency.toLowerCase();
    if (!isSupportedCurrency(currency) || products.some((p) => p.currency.toLowerCase() !== currency)) {
      throw new CheckoutError("CURRENCY_MISMATCH", "Les produits de votre panier ne peuvent pas être payés ensemble.");
    }

    // Les prix viennent exclusivement de la base ; le total est calculé côté serveur en entiers.
    const priced = lines.map((line) => {
      const product = byId.get(line.productId)!;
      return { product, quantity: line.quantity, totalCents: product.priceCents * line.quantity };
    });
    const subtotalCents = priced.reduce((sum, l) => sum + l.totalCents, 0);
    const shippingCents = computeShippingCents(subtotalCents, shippingConfig);
    const totalCents = subtotalCents + shippingCents;
    if (!Number.isSafeInteger(totalCents) || subtotalCents <= 0) {
      throw new CheckoutError("INVALID_CART", "Le total de votre panier est invalide.");
    }

    const reservation = await tryReserveStock(tx, lines);
    if (!reservation.ok) {
      const name = byId.get(reservation.productId)?.name ?? "Un produit";
      throw new CheckoutError("OUT_OF_STOCK", `${name} : stock insuffisant pour la quantité demandée.`);
    }

    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
    const order = await tx.order.create({
      data: {
        cartId,
        userId,
        currency,
        subtotalCents,
        shippingCents,
        totalCents,
        itemsFingerprint: fp,
        expiresAt,
        items: {
          create: priced.map((l) => ({
            productId: l.product.id,
            productName: l.product.name,
            unitPriceCents: l.product.priceCents,
            quantity: l.quantity,
            totalCents: l.totalCents,
          })),
        },
        payments: { create: { amountCents: totalCents, currency } },
      },
      include: { payments: true },
    });

    return {
      kind: "new",
      orderId: order.id,
      paymentId: order.payments[0].id,
      currency,
      expiresAt,
      shippingCents,
      items: priced.map((l) => ({
        name: l.product.name,
        unitPriceCents: l.product.priceCents,
        quantity: l.quantity,
        imageUrl: l.product.imageUrl,
      })),
      supersededSessionId,
    };
  });
}

async function releaseInOwnTransaction(orderId: string, status: "CANCELED" | "EXPIRED") {
  await prisma.$transaction((tx) => releaseOrder(tx, orderId, status));
}

/**
 * Crée (ou réutilise) une session Stripe Checkout pour un panier.
 * Renvoie l'URL de paiement hébergée par Stripe.
 */
export async function createCheckoutSession(
  raw: unknown,
  context: CheckoutContext = {},
): Promise<{ url: string }> {
  const parsed = checkoutInputSchema.safeParse(raw);
  if (!parsed.success) throw new CheckoutError("INVALID_CART", "Votre panier est invalide. Vérifiez-le puis réessayez.");
  const { cartId } = parsed.data;
  const lines = normalizeLines(parsed.data.items);
  const baseUrl = getBaseUrl();
  const stripe = getStripe();
  const shippingConfig = getShippingConfig();
  const automaticTax = isAutomaticTaxEnabled();

  for (let attempt = 0; attempt < 2; attempt++) {
    const plan = await planOrder(cartId, lines, context.userId ?? null, shippingConfig);

    if (plan.kind === "reuse") {
      // Ne pas créer une nouvelle session à chaque clic : on reprend celle du même panier.
      const existing = await stripe.checkout.sessions.retrieve(plan.sessionId);
      if (existing.status === "open" && existing.url) return { url: existing.url };
      if (existing.status === "complete") {
        return { url: `${baseUrl}/success?session_id=${encodeURIComponent(existing.id)}` };
      }
      await releaseInOwnTransaction(plan.orderId, "EXPIRED");
      continue;
    }

    let session: Stripe.Checkout.Session;
    let url: string;
    try {
      session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          locale: "fr",
          client_reference_id: plan.orderId,
          metadata: { orderId: plan.orderId },
          payment_intent_data: { metadata: { orderId: plan.orderId } },
          line_items: plan.items.map((item) => ({
            quantity: item.quantity,
            price_data: {
              currency: plan.currency,
              unit_amount: item.unitPriceCents,
              product_data: {
                name: item.name,
                images: item.imageUrl?.startsWith("https://") ? [item.imageUrl] : undefined,
              },
              tax_behavior: automaticTax ? "exclusive" : undefined,
            },
          })),
          // Livraison : adresse collectée par Stripe, frais forfaitaires calculés côté serveur.
          ...(shippingConfig && {
            shipping_address_collection: { allowed_countries: shippingConfig.countries },
            shipping_options: [
              {
                shipping_rate_data: {
                  type: "fixed_amount" as const,
                  display_name: plan.shippingCents === 0 ? "Livraison offerte" : "Livraison standard",
                  fixed_amount: { amount: plan.shippingCents, currency: plan.currency },
                  tax_behavior: automaticTax ? ("exclusive" as const) : undefined,
                },
              },
            ],
          }),
          // Taxes calculées par Stripe Tax (opt-in : STRIPE_AUTOMATIC_TAX=true).
          ...(automaticTax && { automatic_tax: { enabled: true } }),
          // Connecté : e-mail prérempli (reçu Stripe envoyé à cette adresse). Invité : Stripe le demande.
          ...(context.email && { customer_email: context.email }),
          expires_at: Math.floor(plan.expiresAt.getTime() / 1000),
          success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${baseUrl}/checkout?canceled=1`,
        },
        { idempotencyKey: `checkout-session-${plan.orderId}` },
      );
      if (!session.url) throw new Error("Stripe returned a Checkout Session without a URL");
      url = session.url;
    } catch (error) {
      log("error", "stripe_checkout_session_failed", {
        orderId: plan.orderId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Compensation : sans session, la réservation de stock n'a plus de raison d'être.
      await releaseInOwnTransaction(plan.orderId, "CANCELED");
      throw new CheckoutError("PAYMENT_UNAVAILABLE", "Impossible de lancer le paiement. Veuillez réessayer.");
    }

    await prisma.payment.update({
      where: { id: plan.paymentId },
      data: { stripeCheckoutSessionId: session.id },
    });
    log("info", "checkout_session_created", { orderId: plan.orderId, stripeCheckoutSessionId: session.id });

    if (plan.supersededSessionId) {
      // Meilleur effort : l'ancienne session ne doit plus pouvoir être payée.
      await stripe.checkout.sessions.expire(plan.supersededSessionId).catch((error: unknown) => {
        log("warn", "stripe_expire_superseded_session_failed", {
          stripeCheckoutSessionId: plan.supersededSessionId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }

    return { url };
  }

  throw new CheckoutError("PAYMENT_UNAVAILABLE", "Impossible de lancer le paiement. Veuillez réessayer.");
}
