// Lecture paresseuse des variables d'environnement : rien ne plante au build,
// l'erreur apparaît au premier usage avec un message explicite.

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export function getStripeSecretKey(): string {
  const key = required("STRIPE_SECRET_KEY");
  if (!/^(sk|rk)_(test|live)_/.test(key)) {
    throw new Error(
      "STRIPE_SECRET_KEY must be a secret key (sk_…) or restricted key (rk_…), not a publishable key (pk_…)",
    );
  }
  return key;
}

export function getStripeWebhookSecret(): string {
  const secret = required("STRIPE_WEBHOOK_SECRET");
  if (!secret.startsWith("whsec_")) {
    throw new Error("STRIPE_WEBHOOK_SECRET must start with whsec_");
  }
  return secret;
}

/** URL publique du site, sans slash final (utilisée pour success_url / cancel_url). */
export function getBaseUrl(): string {
  const raw = required("NEXT_PUBLIC_BASE_URL");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("NEXT_PUBLIC_BASE_URL must be an absolute URL, e.g. http://localhost:3000");
  }
  return url.origin;
}
