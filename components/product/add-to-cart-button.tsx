"use client";

import { Check, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/hooks/use-hydrated";
import { MAX_QUANTITY_PER_PRODUCT } from "@/lib/limits";
import { cn } from "@/lib/utils";
import type { ProductView } from "@/services/product-service";
import { useCartDrawer, useCartStore } from "@/store/cart-store";

type CartProduct = Pick<ProductView, "id" | "name" | "priceCents" | "currency" | "imageUrl" | "stock">;

/** Bouton rond « + » des cartes produit : ajoute une unité et ouvre le panier. */
export function AddToCartButton({ product, className }: { product: CartProduct; className?: string }) {
  const addItem = useCartStore((state) => state.addItem);
  const inCart = useCartStore((state) => state.items.find((item) => item.id === product.id)?.quantity ?? 0);
  const openDrawer = useCartDrawer((state) => state.setOpen);
  const hydrated = useHydrated();
  const [added, setAdded] = useState(false);

  const max = Math.min(product.stock, MAX_QUANTITY_PER_PRODUCT);
  const disabled = !hydrated || product.stock <= 0 || inCart >= max;

  return (
    <Button
      type="button"
      size="icon"
      disabled={disabled}
      aria-label={product.stock <= 0 ? `${product.name} : rupture de stock` : `Ajouter ${product.name} au panier`}
      className={cn("size-10 rounded-full shadow-sm transition-transform active:scale-95", className)}
      onClick={() => {
        addItem({
          id: product.id,
          name: product.name,
          price: product.priceCents,
          currency: product.currency,
          imageUrl: product.imageUrl,
          quantity: 1,
        });
        setAdded(true);
        setTimeout(() => setAdded(false), 1200);
        openDrawer(true);
      }}
    >
      {added ? <Check className="size-5" /> : <Plus className="size-5" />}
    </Button>
  );
}
