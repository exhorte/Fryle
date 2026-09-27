import type { Metadata } from "next";
import Link from "next/link";
import { PackageSearch, Search, X } from "lucide-react";
import { ProductGrid } from "@/components/product/product-card";
import { SortSelect } from "@/components/product/sort-select";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { Button } from "@/components/ui/button";
import { CATEGORIES, categoryBySlug, parseSort } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { listProducts } from "@/services/product-service";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ categorie?: string; q?: string; tri?: string; promo?: string }>;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const { categorie, promo } = await searchParams;
  return { title: promo ? "Bons plans" : (categoryBySlug(categorie)?.label ?? "Boutique") };
}

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const category = categoryBySlug(params.categorie);
  const query = params.q?.trim().slice(0, 100) || undefined;
  const sort = parseSort(params.tri);
  const onSale = params.promo === "1";

  const products = await listProducts({ category: category?.value, query, onSale, sort });

  const title = onSale ? "Bons plans" : (category?.label ?? "Toute la boutique");
  const description = onSale
    ? "Nos prix réduits du moment, dans la limite des stocks."
    : (category?.description ?? "Smartphones, ordinateurs, montres, audio et accessoires.");

  // Liens de filtre : conservent la recherche et le tri en cours (sauf mention contraire).
  const hrefFor = (next: { categorie?: string; promo?: boolean; q?: string | null }) => {
    const search = new URLSearchParams();
    if (next.categorie) search.set("categorie", next.categorie);
    if (next.promo) search.set("promo", "1");
    const q = next.q === undefined ? query : next.q;
    if (q) search.set("q", q);
    if (sort !== "pertinence") search.set("tri", sort);
    const qs = search.toString();
    return qs ? `/products?${qs}` : "/products";
  };

  const chips = [
    { key: "all", label: "Tout", href: hrefFor({}), active: !category && !onSale },
    ...CATEGORIES.map((c) => ({ key: c.slug, label: c.label, href: hrefFor({ categorie: c.slug }), active: category?.slug === c.slug && !onSale })),
    { key: "promo", label: "Bons plans", href: hrefFor({ promo: true }), active: onSale },
  ];

  return (
    <div>
      <Breadcrumbs items={[{ label: "Accueil", href: "/" }, { label: "Boutique", href: "/products" }, ...(category || onSale ? [{ label: title }] : [])]} />

      <header className="mb-8 space-y-2">
        <h1 className="text-4xl font-semibold md:text-5xl">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </header>

      <nav aria-label="Filtrer par catégorie" className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {chips.map((chip) => (
          <Link
            key={chip.key}
            href={chip.href}
            aria-current={chip.active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              chip.active ? "border-foreground bg-foreground text-background" : "hover:border-foreground/40",
              chip.key === "promo" && !chip.active && "text-sale",
            )}
          >
            {chip.label}
          </Link>
        ))}
      </nav>

      <form action="/products" className="mb-8 flex flex-col gap-3 border-y py-4 sm:flex-row sm:items-center sm:justify-between">
        {category && <input type="hidden" name="categorie" value={category.slug} />}
        {onSale && <input type="hidden" name="promo" value="1" />}
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <label htmlFor="catalog-search" className="sr-only">
            Rechercher dans {title.toLowerCase()}
          </label>
          <input
            id="catalog-search"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Rechercher…"
            className="h-10 w-full rounded-full border bg-background pr-4 pl-10 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
          />
        </div>
        <div className="flex items-center justify-between gap-4 sm:justify-end">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {products.length} produit{products.length > 1 ? "s" : ""}
          </p>
          <SortSelect value={sort} />
          <noscript>
            <Button type="submit" variant="outline" className="rounded-full">
              Appliquer
            </Button>
          </noscript>
        </div>
      </form>

      {query && (
        <p className="-mt-4 mb-8 flex items-center gap-2 text-sm">
          Résultats pour <span className="font-semibold">« {query} »</span>
          <Link href={hrefFor({ categorie: category?.slug, promo: onSale, q: null })} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
            <X className="size-3.5" /> Effacer
          </Link>
        </p>
      )}

      {products.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-3xl bg-surface px-6 py-20 text-center">
          <PackageSearch className="size-10 text-muted-foreground" strokeWidth={1.5} />
          <div className="space-y-1">
            <p className="text-lg font-medium">Aucun produit ne correspond</p>
            <p className="text-muted-foreground">Essayez une autre recherche ou une autre catégorie.</p>
          </div>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/products">Voir toute la boutique</Link>
          </Button>
        </div>
      ) : (
        <ProductGrid products={products} />
      )}
    </div>
  );
}
