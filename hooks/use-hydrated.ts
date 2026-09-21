import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * false pendant le rendu serveur et l'hydratation, true ensuite.
 * Sert à n'afficher l'état du panier (localStorage) qu'une fois hydraté, sans décalage serveur/client.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
