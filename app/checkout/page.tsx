import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { getShippingDisplay } from "@/lib/shipping-display";
import { isAutomaticTaxEnabled } from "@/lib/store-config";
import { CheckoutView } from "./checkout-view";

export const metadata: Metadata = { title: "Panier" };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ canceled?: string }> }) {
  const { canceled } = await searchParams;
  // Livraison et taxes lues dans la configuration serveur, pour un récapitulatif fidèle.
  const shipping = getShippingDisplay();

  return (
    <div>
      <Breadcrumbs items={[{ label: "Accueil", href: "/" }, { label: "Panier" }]} />
      <h1 className="mb-8 text-4xl font-semibold md:text-5xl">Votre panier</h1>
      <CheckoutView
        canceled={canceled === "1"}
        shipping={{ flatCents: shipping.flatCents, freeOverCents: shipping.freeOverCents, automaticTax: isAutomaticTaxEnabled() }}
      />
    </div>
  );
}
