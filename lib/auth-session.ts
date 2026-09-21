import { headers } from "next/headers";
import { getAuth } from "./auth";
import { enabledProviders } from "./auth-config";
import { log } from "./log";

export type CurrentUser = { id: string; email: string; name: string };

/**
 * Utilisateur connecté, lu côté serveur à partir du cookie de session. C'est la seule source
 * d'identité : un identifiant utilisateur venant d'un formulaire ou d'un corps de requête n'est jamais cru.
 * Renvoie null sans session, ou si l'authentification n'est pas configurée (paiement invité).
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (enabledProviders().length === 0) return null;
  try {
    const session = await getAuth().api.getSession({ headers: await headers() });
    if (!session) return null;
    return { id: session.user.id, email: session.user.email, name: session.user.name };
  } catch (error) {
    log("warn", "auth_session_unavailable", { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}
