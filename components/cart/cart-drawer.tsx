"use client";

import Link from "next/link";
import { ShoppingBag, Trash2 } from "lucide-react";
import { ProductImage } from "@/components/product/product-image";
import { QuantityStepper } from "@/components/product/quantity-stepper";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useHydrated } from "@/hooks/use-hydrated";
import { MAX_QUANTITY_PER_PRODUCT } from "@/lib/limits";
import { formatMoney } from "@/lib/money";
import { useCartDrawer, useCartStore } from "@/store/cart-store";

export function CartDrawer() {
  const { items, addItem, removeItem, removeLine } = useCartStore();
  const { open, setOpen } = useCartDrawer();
  const hydrated = useHydrated();
  const lines = hydrated ? items : [];
  const count = lines.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = lines.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const currency = lines[0]?.currency ?? "cad";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle className="font-display text-xl">Votre panier</SheetTitle>
          <SheetDescription>
            {count === 0 ? "Aucun article pour le moment." : `${count} article${count > 1 ? "s" : ""}`}
          </SheetDescription>
        </SheetHeader>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-muted">
              <ShoppingBag className="size-7 text-muted-foreground" />
            </span>
            <p className="text-muted-foreground">Votre panier est vide.</p>
            <Button asChild className="rounded-full" onClick={() => setOpen(false)}>
              <Link href="/products">Découvrir la boutique</Link>
            </Button>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y overflow-y-auto px-6">
              {lines.map((item) => (
                <li key={item.id} className="flex gap-4 py-5">
                  <Link
                    href={`/products/${item.id}`}
                    onClick={() => setOpen(false)}
                    className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-surface"
                  >
                    <ProductImage src={item.imageUrl} alt={item.name} sizes="80px" />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        href={`/products/${item.id}`}
                        onClick={() => setOpen(false)}
                        className="line-clamp-2 text-sm leading-snug font-medium hover:underline"
                      >
                        {item.name}
                      </Link>
                      <button
                        type="button"
                        onClick={() => removeLine(item.id)}
                        className="text-muted-foreground transition-colors hover:text-foreground"
                        aria-label={`Retirer ${item.name} du panier`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <QuantityStepper
                        size="sm"
                        label={item.name}
                        value={item.quantity}
                        min={1}
                        max={MAX_QUANTITY_PER_PRODUCT}
                        onDecrement={() => removeItem(item.id)}
                        onIncrement={() => addItem({ ...item, quantity: 1 })}
                      />
                      <span className="text-sm font-semibold tabular-nums">
                        {formatMoney(item.price * item.quantity, item.currency)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <SheetFooter className="gap-3 border-t bg-muted/40 px-6 py-5">
              <div className="flex items-center justify-between text-base font-semibold">
                <span>Sous-total</span>
                <span className="tabular-nums">{formatMoney(subtotal, currency)}</span>
              </div>
              <p className="text-xs text-muted-foreground">Livraison et taxes calculées à l&apos;étape suivante.</p>
              <Button asChild size="lg" className="h-12 rounded-full text-base" onClick={() => setOpen(false)}>
                <Link href="/checkout">Passer la commande</Link>
              </Button>
              <Button variant="ghost" className="rounded-full" onClick={() => setOpen(false)}>
                Continuer mes achats
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
