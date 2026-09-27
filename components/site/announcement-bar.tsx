import Link from "next/link";
import { RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { enabledProviders } from "@/lib/auth-config";
import { getShippingDisplay } from "@/lib/shipping-display";
import { siteConfig } from "@/lib/site-config";

export function AnnouncementBar() {
  const shipping = getShippingDisplay();
  return (
    <div className="bg-foreground text-background">
      <div className="mx-auto flex h-9 max-w-7xl items-center justify-between gap-4 px-4 text-xs sm:px-6 lg:px-8">
        <ul className="flex items-center gap-6">
          <li className="flex items-center gap-1.5">
            <Truck className="size-3.5" aria-hidden />
            {shipping.headline}
          </li>
          <li className="hidden items-center gap-1.5 sm:flex">
            <RotateCcw className="size-3.5" aria-hidden />
            Retours sous {siteConfig.returnDays} jours
          </li>
          <li className="hidden items-center gap-1.5 md:flex">
            <ShieldCheck className="size-3.5" aria-hidden />
            {siteConfig.warrantyLabel}
          </li>
        </ul>
        {enabledProviders().length > 0 && (
          <Link href="/orders" className="shrink-0 text-background/80 transition-colors hover:text-background">
            Suivre ma commande
          </Link>
        )}
      </div>
    </div>
  );
}
