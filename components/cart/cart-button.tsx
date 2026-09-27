"use client";

import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/hooks/use-hydrated";
import { useCartDrawer, useCartStore } from "@/store/cart-store";

export function CartButton() {
  const items = useCartStore((state) => state.items);
  const setOpen = useCartDrawer((state) => state.setOpen);
  const hydrated = useHydrated();
  // Le panier vit dans le localStorage : on ne l'affiche qu'après hydratation.
  const count = hydrated ? items.reduce((sum, item) => sum + item.quantity, 0) : 0;

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative rounded-full"
      aria-label={count > 0 ? `Panier, ${count} article${count > 1 ? "s" : ""}` : "Panier"}
      onClick={() => setOpen(true)}
    >
      <ShoppingBag className="size-5" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-semibold text-brand-foreground">
          {count}
        </span>
      )}
    </Button>
  );
}
