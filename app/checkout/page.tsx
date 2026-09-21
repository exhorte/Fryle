"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useHydrated } from "@/hooks/use-hydrated";
import { formatMoney } from "@/lib/money";
import { useCartStore } from "@/store/cart-store";
import { checkoutAction, type CheckoutState } from "./checkout-action";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="default" className="w-full" disabled={pending}>
      {pending ? "Redirecting to payment…" : "Proceed to Payment"}
    </Button>
  );
}

export default function CheckoutPage() {
  const { cartId, items, removeItem, addItem } = useCartStore();
  const hydrated = useHydrated();
  const [state, formAction] = useActionState<CheckoutState, FormData>(checkoutAction, {});

  if (!hydrated) return null; // le panier est dans le localStorage : rien à afficher avant l'hydratation

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="mb-4 text-3xl font-bold">Your Cart is Empty</h1>
      </div>
    );
  }

  const currency = items[0].currency;
  const total = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  // Seuls l'identifiant du panier, les ids produits et les quantités partent au serveur.
  const payload = JSON.stringify({
    cartId,
    items: items.map((item) => ({ productId: item.id, quantity: item.quantity })),
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-center text-3xl font-bold">Checkout</h1>
      <Card className="mx-auto mb-8 max-w-md">
        <CardHeader>
          <CardTitle className="text-xl font-bold">Order Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {items.map((item) => (
              <li key={item.id} className="flex flex-col gap-2 border-b pb-2">
                <div className="flex justify-between">
                  <span className="font-medium">{item.name}</span>
                  <span className="font-semibold">{formatMoney(item.price * item.quantity, item.currency)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" aria-label={`Remove one ${item.name}`} onClick={() => removeItem(item.id)}>
                    –
                  </Button>
                  <span className="text-lg font-semibold">{item.quantity}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Add one ${item.name}`}
                    onClick={() => addItem({ ...item, quantity: 1 })}
                  >
                    +
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t pt-2 text-lg font-semibold">Total: {formatMoney(total, currency)}</div>
          <p className="mt-2 text-xs text-neutral-500">The final amount is confirmed on the secure payment page.</p>
        </CardContent>
      </Card>
      <form action={formAction} className="mx-auto max-w-md space-y-3">
        <input type="hidden" name="payload" value={payload} />
        {state.error && (
          <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {state.error}
          </p>
        )}
        <SubmitButton />
      </form>
    </div>
  );
}
