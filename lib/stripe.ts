import Stripe from "stripe";
import { getStripeSecretKey } from "./env";

// Client Stripe unique et centralisé. Côté serveur uniquement : ne jamais l'importer
// depuis un composant client.
const globalForStripe = globalThis as unknown as { stripe?: Stripe };

export function getStripe(): Stripe {
  globalForStripe.stripe ??= new Stripe(getStripeSecretKey(), {
    // Les POST réessayés reçoivent automatiquement une clé d'idempotence.
    maxNetworkRetries: 2,
    appInfo: { name: "e-commerce" },
  });
  return globalForStripe.stripe;
}
