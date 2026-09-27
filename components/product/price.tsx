import { discountPercent } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

interface Props {
  priceCents: number;
  compareAtPriceCents: number | null;
  currency: string;
  size?: "sm" | "lg";
  className?: string;
}

export function Price({ priceCents, compareAtPriceCents, currency, size = "sm", className }: Props) {
  const onSale = discountPercent(priceCents, compareAtPriceCents) !== null;
  return (
    <p className={cn("flex flex-wrap items-baseline gap-x-2", className)}>
      <span className={cn("font-semibold tabular-nums", size === "lg" ? "text-3xl" : "text-base", onSale && "text-sale")}>
        {formatMoney(priceCents, currency)}
      </span>
      {onSale && (
        <>
          <span className="sr-only">au lieu de</span>
          <s className={cn("text-muted-foreground tabular-nums", size === "lg" ? "text-lg" : "text-sm")}>
            {formatMoney(compareAtPriceCents!, currency)}
          </s>
        </>
      )}
    </p>
  );
}

export function DiscountBadge({
  priceCents,
  compareAtPriceCents,
  className,
}: Pick<Props, "priceCents" | "compareAtPriceCents" | "className">) {
  const percent = discountPercent(priceCents, compareAtPriceCents);
  if (percent === null) return null;
  return (
    <span className={cn("rounded-full bg-sale px-2.5 py-1 text-xs font-semibold text-sale-foreground", className)}>
      -{percent} %
    </span>
  );
}
