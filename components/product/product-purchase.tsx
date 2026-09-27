"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShoppingBag, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/hooks/use-hydrated";
import { MAX_QUANTITY_PER_PRODUCT } from "@/lib/limits";
import type { ProductView } from "@/services/product-service";
import { useCartDrawer, useCartStore } from "@/store/cart-store";
import { QuantityStepper } from "./quantity-stepper";

type Props = { product: Pick<ProductView, "id" | "name" | "priceCents" | "currency" | "imageUrl" | "stock"> };

/** Choix de la quantité, ajout au panier et achat immédiat. Le serveur revalide tout au paiement. */
export function ProductPurchase({ product }: Props) {
  const router = useRouter();
  const hydrated = useHydrated();
  const addItem = useCartStore((state) => state.addItem);
  const inCart = useCartStore((state) => state.items.find((item) => item.id === product.id)?.quantity ?? 0);
  const openDrawer = useCartDrawer((state) => state.setOpen);
  const [quantity, setQuantity] = useState(1);

  const available = Math.max(0, Math.min(product.stock, MAX_QUANTITY_PER_PRODUCT) - (hydrated ? inCart : 0));
  const qty = Math.min(quantity, Math.max(available, 1));

  if (product.stock <= 0) {
    return (
      <Button size="lg" disabled className="h-13 w-full rounded-full text-base">
        Rupture de stock
      </Button>
    );
  }

  const add = () =>
    addItem({
      id: product.id,
      name: product.name,
      price: product.priceCents,
      currency: product.currency,
      imageUrl: product.imageUrl,
      quantity: qty,
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <QuantityStepper
          label={product.name}
          value={qty}
          max={Math.max(available, 1)}
          onDecrement={() => setQuantity(Math.max(1, qty - 1))}
          onIncrement={() => setQuantity(Math.min(available, qty + 1))}
        />
        {hydrated && inCart > 0 && (
          <p className="text-sm text-muted-foreground">
            {inCart} déjà dans votre panier{available === 0 && " (quantité maximale atteinte)"}
          </p>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          size="lg"
          className="h-13 rounded-full text-base"
          disabled={!hydrated || available === 0}
          onClick={() => {
            add();
            setQuantity(1);
            openDrawer(true);
          }}
        >
          <ShoppingBag /> Ajouter au panier
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-13 rounded-full text-base"
          disabled={!hydrated || (available === 0 && inCart === 0)}
          onClick={() => {
            if (available > 0) add();
            router.push("/checkout");
          }}
        >
          <Zap /> Acheter maintenant
        </Button>
      </div>
    </div>
  );
}
