// Fournisseurs OAuth activés. Fichier volontairement léger (aucun import serveur) : utilisable partout.
// Un fournisseur n'est actif que si son ID client ET son secret sont définis.

export type OAuthProvider = "google" | "github";

export function enabledProviders(): OAuthProvider[] {
  const providers: OAuthProvider[] = [];
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) providers.push("google");
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) providers.push("github");
  return providers;
}
