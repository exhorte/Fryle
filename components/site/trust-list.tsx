import { Lock, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { getShippingDisplay } from "@/lib/shipping-display";
import { siteConfig } from "@/lib/site-config";
import { cn } from "@/lib/utils";

/** Engagements de la boutique (livraison dérivée de la configuration réelle). */
export function getTrustItems() {
  const shipping = getShippingDisplay();
  return [
    { icon: Truck, title: shipping.headline, detail: shipping.detail },
    { icon: RotateCcw, title: `Retours sous ${siteConfig.returnDays} jours`, detail: "Échange ou remboursement" },
    { icon: ShieldCheck, title: siteConfig.warrantyLabel, detail: siteConfig.warrantyDetail },
    { icon: Lock, title: "Paiement sécurisé", detail: "Transactions chiffrées via Stripe" },
  ];
}

export function TrustStrip({ className }: { className?: string }) {
  return (
    <ul className={cn("grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4", className)}>
      {getTrustItems().map(({ icon: Icon, title, detail }) => (
        <li key={title} className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted sm:size-12">
            <Icon className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-sm text-muted-foreground">{detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function TrustList({ className }: { className?: string }) {
  return (
    <ul className={cn("grid gap-3 sm:grid-cols-2", className)}>
      {getTrustItems().map(({ icon: Icon, title, detail }) => (
        <li key={title} className="flex items-start gap-3 rounded-xl bg-muted/60 p-3">
          <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground">{detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
