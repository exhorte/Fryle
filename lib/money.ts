// Tous les montants sont des entiers en unité mineure (centimes pour CAD/USD/EUR),
// exactement le format attendu par Stripe. Aucune arithmétique sur des flottants.

/** Devises acceptées par la boutique (toutes à 2 décimales). */
export const SUPPORTED_CURRENCIES = ["cad", "usd", "eur", "gbp"] as const;

export function isSupportedCurrency(currency: string): boolean {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(currency.toLowerCase());
}

/** Nombre de décimales de la devise (2 pour CAD, 0 pour JPY…). */
export function currencyDigits(currency: string): number {
  return (
    new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase() }).resolvedOptions()
      .maximumFractionDigits ?? 2
  );
}

/** Affichage uniquement (« 1 299,00 $ ») : ne jamais réutiliser le résultat dans un calcul. */
export function formatMoney(amountMinor: number, currency: string, locale = "fr-CA"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountMinor / 10 ** currencyDigits(currency));
}
