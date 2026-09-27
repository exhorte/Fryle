import { cn } from "@/lib/utils";

const LOW_STOCK = 5;

export function StockStatus({ stock, className }: { stock: number; className?: string }) {
  const [label, tone] =
    stock <= 0
      ? ["Rupture de stock", "bg-muted-foreground"]
      : stock <= LOW_STOCK
        ? [`Plus que ${stock} en stock`, "bg-amber-500"]
        : ["En stock", "bg-emerald-500"];
  return (
    <p className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
      <span aria-hidden className={cn("size-2 rounded-full", tone)} />
      {label}
    </p>
  );
}
