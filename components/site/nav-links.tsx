"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CATEGORIES } from "@/lib/catalog";
import { cn } from "@/lib/utils";

/** Liens de catégories, avec l'entrée active mise en évidence. */
export function NavLinks({ className }: { className?: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const onShop = pathname === "/products";
  const current = onShop ? (params.get("promo") ? "promo" : (params.get("categorie") ?? "all")) : null;

  const item = (key: string, href: string, label: string, extra?: string) => (
    <Link
      key={key}
      href={href}
      aria-current={current === key ? "page" : undefined}
      className={cn(
        "relative py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
        "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:scale-x-0 after:rounded-full after:bg-foreground after:transition-transform",
        current === key && "text-foreground after:scale-x-100",
        extra,
      )}
    >
      {label}
    </Link>
  );

  return (
    <nav aria-label="Catégories" className={cn("flex items-center gap-7", className)}>
      {item("all", "/products", "Toute la boutique")}
      {CATEGORIES.map((category) => item(category.slug, `/products?categorie=${category.slug}`, category.label))}
      {item("promo", "/products?promo=1", "Bons plans", "text-sale hover:text-sale")}
    </nav>
  );
}

/** Version statique (rendu serveur / avant hydratation), sans état actif. */
export function NavLinksFallback({ className }: { className?: string }) {
  return (
    <nav aria-label="Catégories" className={cn("flex items-center gap-7", className)}>
      <Link href="/products" className="py-3 text-sm font-medium text-muted-foreground">
        Toute la boutique
      </Link>
      {CATEGORIES.map((category) => (
        <Link
          key={category.slug}
          href={`/products?categorie=${category.slug}`}
          className="py-3 text-sm font-medium text-muted-foreground"
        >
          {category.label}
        </Link>
      ))}
      <Link href="/products?promo=1" className="py-3 text-sm font-medium text-sale">
        Bons plans
      </Link>
    </nav>
  );
}
