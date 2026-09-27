import { CategoryGrid } from "@/components/home/category-grid";
import { Hero } from "@/components/home/hero";
import { NewsletterSection } from "@/components/home/newsletter-section";
import { PromoBanners } from "@/components/home/promo-banners";
import { ProductCard, ProductGrid } from "@/components/product/product-card";
import { ProductRail, RailItem } from "@/components/product/product-rail";
import { SectionHeading } from "@/components/site/section-heading";
import { TrustStrip } from "@/components/site/trust-list";
import {
  countProductsByCategory,
  listDeals,
  listFeaturedProducts,
} from "@/services/product-service";

// Le stock et les prix changent à chaque commande : pas de rendu statique.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [featured, deals, counts] = await Promise.all([
    listFeaturedProducts(10),
    listDeals(4),
    countProductsByCategory(),
  ]);
  const heroProduct = featured.find((product) => product.category === "SMARTPHONE") ?? null;

  return (
    <div className="space-y-20 lg:space-y-28">
      <div className="space-y-12">
        <Hero product={heroProduct} />
        <TrustStrip className="px-2" />
      </div>

      <section>
        <SectionHeading title="Explorer par catégorie" href="/products" linkLabel="Toute la boutique" />
        <CategoryGrid counts={counts} />
      </section>

      {featured.length > 0 && (
        <section>
          <SectionHeading
            title="Nos incontournables"
            description="Les appareils que nos clients choisissent le plus souvent."
            href="/products"
          />
          <ProductRail label="Nos incontournables">
            {featured.map((product) => (
              <RailItem key={product.id}>
                <ProductCard product={product} />
              </RailItem>
            ))}
          </ProductRail>
        </section>
      )}

      <PromoBanners />

      {deals.length > 0 && (
        <section>
          <SectionHeading title="Bons plans" description="Des prix réduits, dans la limite des stocks." href="/products?promo=1" />
          <ProductGrid products={deals} />
        </section>
      )}

      <NewsletterSection />
    </div>
  );
}
