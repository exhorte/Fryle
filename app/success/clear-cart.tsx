"use client";

import { useEffect } from "react";
import { useCartStore } from "@/store/cart-store";

/** Vide le panier une fois le paiement confirmé par le serveur — et seulement s'il s'agit du même panier. */
export function ClearCart({ cartId }: { cartId: string }) {
  useEffect(() => {
    const { cartId: currentCartId, clearCart } = useCartStore.getState();
    if (currentCartId === cartId) clearCart();
  }, [cartId]);

  return null;
}
