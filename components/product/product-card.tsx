import Link from "next/link";
import { categoryByValue } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import type { ProductView } from "@/services/product-service";
import { AddToCartButton } from "./add-to-cart-button";
import { DiscountBadge, Price } from "./price";
import { ProductImage } from "./product-image";

export function ProductCard({ product, className }: { product: ProductView; className?: string }) {
  const href = `/products/${product.id}`;
  const soldOut = product.stock <= 0;
  const lowStock = !soldOut && product.stock <= 5;

  return (
    <article className={cn("group relative flex h-full flex-col", className)}>
      <Link
        href={href}
        className="relative block aspect-square overflow-hidden rounded-2xl bg-surface transition-shadow duration-300 group-hover:shadow-[0_12px_40px_-16px_rgb(0_0_0/0.25)]"
        tabIndex={-1}
        aria-hidden
      >
        <ProductImage
          src={product.imageUrl}
          alt=""
          sizes="(min-width: 1280px) 300px, (min-width: 768px) 33vw, 50vw"
          className={cn("group-hover:scale-105", soldOut && "opacity-50")}
        />
      </Link>

      <div className="pointer-events-none absolute top-3 left-3 flex flex-col items-start gap-1.5">
        <DiscountBadge priceCents={product.priceCents} compareAtPriceCents={product.compareAtPriceCents} />
        {soldOut && (
          <span className="rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium shadow-sm">Épuisé</span>
        )}
        {lowStock && (
          <span className="rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium text-amber-700 shadow-sm">
            Plus que {product.stock}
          </span>
        )}
      </div>

      <div className="flex flex-1 items-end justify-between gap-3 pt-4">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {categoryByValue(product.category).label}
          </p>
          <h3 className="line-clamp-2 font-sans text-sm leading-snug font-medium tracking-normal">
            <Link href={href} className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none">
              {product.name}
            </Link>
          </h3>
          <Price priceCents={product.priceCents} compareAtPriceCents={product.compareAtPriceCents} currency={product.currency} />
        </div>
        {/* Au-dessus du lien étendu de la carte */}
        <AddToCartButton product={product} className="relative z-10 shrink-0" />
      </div>
    </article>
  );
}

export function ProductGrid({ products, className }: { products: ProductView[]; className?: string }) {
  return (
    <ul className={cn("grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 xl:grid-cols-4", className)}>
      {products.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}
