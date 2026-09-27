"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowLeft, Lock, ShoppingBag, Trash2 } from "lucide-react";
import { ProductImage } from "@/components/product/product-image";
import { QuantityStepper } from "@/components/product/quantity-stepper";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useHydrated } from "@/hooks/use-hydrated";
import { MAX_QUANTITY_PER_PRODUCT } from "@/lib/limits";
import { formatMoney } from "@/lib/money";
import { useCartStore } from "@/store/cart-store";
import { checkoutAction, type CheckoutState } from "./checkout-action";

export type ShippingSummary = { flatCents: number | null; freeOverCents: number | null; automaticTax: boolean };

function PayButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="h-13 w-full rounded-full text-base" disabled={pending}>
      <Lock /> {pending ? "Redirection vers le paiement…" : "Payer en toute sécurité"}
    </Button>
  );
}

export function CheckoutView({ shipping, canceled }: { shipping: ShippingSummary; canceled: boolean }) {
  const { cartId, items, removeItem, addItem, removeLine } = useCartStore();
  const hydrated = useHydrated();
  const [state, formAction] = useActionState<CheckoutState, FormData>(checkoutAction, {});

  if (!hydrated) {
    // Le panier est dans le localStorage : squelette le temps de l'hydratation.
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <Skeleton className="h-72 rounded-3xl" />
        <Skeleton className="h-80 rounded-3xl" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-5 rounded-3xl bg-surface px-6 py-20 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-background">
          <ShoppingBag className="size-7 text-muted-foreground" />
        </span>
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold">Votre panier est vide</h2>
          <p className="text-muted-foreground">Parcourez la boutique pour trouver votre prochain appareil.</p>
        </div>
        <Button asChild size="lg" className="rounded-full">
          <Link href="/products">Découvrir la boutique</Link>
        </Button>
      </div>
    );
  }

  const currency = items[0].currency;
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingCents =
    shipping.flatCents === null || (shipping.freeOverCents !== null && subtotal >= shipping.freeOverCents)
      ? 0
      : shipping.flatCents;
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  // Seuls l'identifiant du panier, les ids produits et les quantités partent au serveur.
  const payload = JSON.stringify({
    cartId,
    items: items.map((item) => ({ productId: item.id, quantity: item.quantity })),
  });

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_400px]">
      <section aria-label="Articles" className="rounded-3xl border">
        <ul className="divide-y">
          {items.map((item) => (
            <li key={item.id} className="flex gap-4 p-4 sm:gap-6 sm:p-6">
              <Link href={`/products/${item.id}`} className="relative size-24 shrink-0 overflow-hidden rounded-2xl bg-surface sm:size-28">
                <ProductImage src={item.imageUrl} alt={item.name} sizes="112px" />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Link href={`/products/${item.id}`} className="font-medium hover:underline">
                      {item.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">{formatMoney(item.price, item.currency)} l&apos;unité</p>
                  </div>
                  <p className="font-semibold tabular-nums">{formatMoney(item.price * item.quantity, item.currency)}</p>
                </div>
                <div className="flex items-center justify-between">
                  <QuantityStepper
                    size="sm"
                    label={item.name}
                    value={item.quantity}
                    max={MAX_QUANTITY_PER_PRODUCT}
                    onDecrement={() => removeItem(item.id)}
                    onIncrement={() => addItem({ ...item, quantity: 1 })}
                  />
                  <button
                    type="button"
                    onClick={() => removeLine(item.id)}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Trash2 className="size-4" /> Retirer
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div className="border-t p-4 sm:px-6">
          <Link href="/products" className="flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Continuer mes achats
          </Link>
        </div>
      </section>

      <aside className="space-y-5 rounded-3xl bg-surface p-6 lg:sticky lg:top-40">
        <h2 className="text-xl font-semibold">Récapitulatif</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">
              Sous-total ({count} article{count > 1 ? "s" : ""})
            </dt>
            <dd className="font-medium tabular-nums">{formatMoney(subtotal, currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Livraison</dt>
            <dd className="font-medium tabular-nums">{shippingCents === 0 ? "Offerte" : formatMoney(shippingCents, currency)}</dd>
          </div>
          {shipping.automaticTax && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Taxes</dt>
              <dd className="text-muted-foreground">Calculées au paiement</dd>
            </div>
          )}
          {shipping.freeOverCents !== null && shippingCents > 0 && (
            <p className="rounded-xl bg-background px-3 py-2 text-xs text-muted-foreground">
              Plus que <span className="font-semibold text-foreground">{formatMoney(shipping.freeOverCents - subtotal, currency)}</span> pour
              la livraison offerte.
            </p>
          )}
          <div className="flex items-baseline justify-between border-t pt-4 text-base">
            <dt className="font-semibold">Total{shipping.automaticTax ? " estimé" : ""}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{formatMoney(subtotal + shippingCents, currency)}</dd>
          </div>
        </dl>

        <form action={formAction} className="space-y-3">
          <input type="hidden" name="payload" value={payload} />
          {canceled && !state.error && (
            <p role="status" className="rounded-xl bg-background p-3 text-sm text-muted-foreground">
              Paiement annulé : votre panier a été conservé.
            </p>
          )}
          {state.error && (
            <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
              {state.error}
            </p>
          )}
          <PayButton />
        </form>
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <Lock className="size-3.5" /> Paiement chiffré sur une page sécurisée Stripe. Le montant final y est confirmé.
        </p>
      </aside>
    </div>
  );
}
