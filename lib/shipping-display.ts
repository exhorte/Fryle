import { formatMoney } from "./money";
import { getShippingConfig } from "./store-config";

// Textes de livraison affichés aux clients, dérivés de la configuration réelle (jamais en dur).

export type ShippingDisplay = {
  /** Court, pour la barre d'annonce et les bandeaux. */
  headline: string;
  /** Précision sous le titre. */
  detail: string;
  /** Pour le récapitulatif du panier : null = livraison non facturée. */
  flatCents: number | null;
  freeOverCents: number | null;
};

export function getShippingDisplay(currency = "cad"): ShippingDisplay {
  let config;
  try {
    config = getShippingConfig();
  } catch {
    config = null;
  }
  if (!config || config.flatCents === 0) {
    return { headline: "Livraison offerte", detail: "Sur toutes les commandes", flatCents: null, freeOverCents: null };
  }
  if (config.freeOverCents !== null) {
    return {
      headline: `Livraison offerte dès ${formatMoney(config.freeOverCents, currency)}`,
      detail: `Sinon ${formatMoney(config.flatCents, currency)}`,
      flatCents: config.flatCents,
      freeOverCents: config.freeOverCents,
    };
  }
  return {
    headline: "Livraison rapide",
    detail: `Forfait de ${formatMoney(config.flatCents, currency)}`,
    flatCents: config.flatCents,
    freeOverCents: null,
  };
}
