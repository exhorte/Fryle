import type Stripe from "stripe";

// Livraison et taxes : options activées uniquement par variables d'environnement.
// Rien n'est activé par défaut, pour ne pas casser le checkout d'un compte Stripe non configuré.

export type ShippingConfig = {
  countries: Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[];
  /** Tarif forfaitaire, en unité mineure de la devise de la commande (ex. 999 = 9,99 $). */
  flatCents: number;
  /** Livraison offerte à partir de ce sous-total (unité mineure) ; null = jamais offerte. */
  freeOverCents: number | null;
};

function readInt(name: string, fallback: number | null): number | null {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer (minor units)`);
  return value;
}

/** SHIPPING_COUNTRIES="CA,US" active la collecte de l'adresse et des frais de livraison forfaitaires. */
export function getShippingConfig(): ShippingConfig | null {
  const raw = process.env.SHIPPING_COUNTRIES?.trim();
  if (!raw) return null;

  const countries = raw.split(",").map((code) => code.trim().toUpperCase()).filter(Boolean);
  if (countries.length === 0 || countries.some((code) => !/^[A-Z]{2}$/.test(code))) {
    throw new Error('SHIPPING_COUNTRIES must be a comma-separated list of ISO country codes, e.g. "CA,US"');
  }
  return {
    countries: countries as ShippingConfig["countries"],
    flatCents: readInt("SHIPPING_FLAT_CENTS", 999) as number,
    freeOverCents: readInt("FREE_SHIPPING_OVER_CENTS", null),
  };
}

/** Frais de livraison calculés côté serveur à partir du sous-total. */
export function computeShippingCents(subtotalCents: number, config: ShippingConfig | null): number {
  if (!config) return 0;
  if (config.freeOverCents !== null && subtotalCents >= config.freeOverCents) return 0;
  return config.flatCents;
}

/** STRIPE_AUTOMATIC_TAX=true : les taxes sont calculées par Stripe Tax (à activer d'abord dans le Dashboard). */
export function isAutomaticTaxEnabled(): boolean {
  return process.env.STRIPE_AUTOMATIC_TAX === "true";
}
