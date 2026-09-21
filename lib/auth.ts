import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { enabledProviders } from "./auth-config";
import { prisma } from "./db";
import { getBaseUrl } from "./env";

// Connexion par Google et/ou GitHub (OAuth). Un fournisseur n'est actif que si son ID client ET son
// secret sont définis : sans configuration, le site fonctionne en paiement invité uniquement.
//
// URLs de rappel à déclarer chez le fournisseur :
//   {NEXT_PUBLIC_BASE_URL}/api/auth/callback/google
//   {NEXT_PUBLIC_BASE_URL}/api/auth/callback/github

function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must be set to a random string of at least 32 characters");
  }

  const providers = enabledProviders();
  return betterAuth({
    baseURL: getBaseUrl(),
    secret,
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    socialProviders: {
      ...(providers.includes("google")
        ? { google: { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! } }
        : {}),
      ...(providers.includes("github")
        ? { github: { clientId: process.env.GITHUB_CLIENT_ID!, clientSecret: process.env.GITHUB_CLIENT_SECRET! } }
        : {}),
    },
    plugins: [nextCookies()], // doit rester le dernier plugin
  });
}

// Création paresseuse : ni le build ni les pages sans authentification ne dépendent de ces variables.
const globalForAuth = globalThis as unknown as { auth?: ReturnType<typeof createAuth> };

export function getAuth() {
  globalForAuth.auth ??= createAuth();
  return globalForAuth.auth;
}
