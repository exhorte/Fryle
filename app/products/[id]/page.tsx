import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { ProductCard } from "@/components/product/product-card";
import { DiscountBadge, Price } from "@/components/product/price";
import { ProductImage } from "@/components/product/product-image";
import { ProductPurchase } from "@/components/product/product-purchase";
import { StockStatus } from "@/components/product/stock-status";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { SectionHeading } from "@/components/site/section-heading";
import { TrustList } from "@/components/site/trust-list";
import { categoryByValue, discountPercent } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { getActiveProduct, listRelatedProducts } from "@/services/product-service";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const product = await getActiveProduct((await params).id);
  return product ? { title: product.name, description: product.description ?? undefined } : { title: "Produit introuvable" };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { id } = await params;
  const product = await getActiveProduct(id);
  if (!product) notFound();

  const category = categoryByValue(product.category);
  const related = await listRelatedProducts(product, 4);
  const saving =
    discountPercent(product.priceCents, product.compareAtPriceCents) !== null
      ? product.compareAtPriceCents! - product.priceCents
      : null;

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Accueil", href: "/" },
          { label: category.label, href: `/products?categorie=${category.slug}` },
          { label: product.name },
        ]}
      />

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="relative aspect-square overflow-hidden rounded-3xl bg-surface lg:sticky lg:top-40 lg:self-start">
          <ProductImage src={product.imageUrl} alt={product.name} sizes="(min-width: 1024px) 600px, 100vw" priority />
          <DiscountBadge
            priceCents={product.priceCents}
            compareAtPriceCents={product.compareAtPriceCents}
            className="absolute top-5 left-5 px-3 py-1.5 text-sm"
          />
        </div>

        <div className="space-y-8">
          <div className="space-y-4">
            <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
              {product.brand} · {category.label}
            </p>
            <h1 className="text-4xl leading-tight font-semibold md:text-5xl">{product.name}</h1>
            <div className="space-y-1">
              <Price
                size="lg"
                priceCents={product.priceCents}
                compareAtPriceCents={product.compareAtPriceCents}
                currency={product.currency}
              />
              {saving !== null && (
                <p className="text-sm font-medium text-sale">Vous économisez {formatMoney(saving, product.currency)}</p>
              )}
            </div>
            <StockStatus stock={product.stock} />
          </div>

          {product.highlights.length > 0 && (
            <ul className="space-y-2.5">
              {product.highlights.map((highlight) => (
                <li key={highlight} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                  {highlight}
                </li>
              ))}
            </ul>
          )}

          <ProductPurchase product={product} />

          <TrustList />

          {product.description && (
            <section className="space-y-3 border-t pt-8">
              <h2 className="text-xl font-semibold">Description</h2>
              <p className="leading-relaxed text-muted-foreground">{product.description}</p>
            </section>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-24">
          <SectionHeading
            title="Vous aimerez aussi"
            href={`/products?categorie=${category.slug}`}
            linkLabel={`Tous les ${category.label.toLowerCase()}`}
          />
          <ul className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
            {related.map((item) => (
              <li key={item.id}>
                <ProductCard product={item} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
