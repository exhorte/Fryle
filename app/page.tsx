import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Carousel } from "@/components/carousel";
import { listActiveProducts } from "@/services/product-service";

// Le stock change à chaque commande : pas de rendu statique.
export const dynamic = "force-dynamic";

export default async function Home() {
  const products = await listActiveProducts(5);
  const hero = products.find((product) => product.imageUrl);

  return (
    <div>
      <section className="rounded bg-neutral-100 py-8 sm:py-12">
        <div className="mx-auto grid grid-cols-1 items-center justify-items-center gap-8 px-8 sm:px-16 md:grid-cols-2">
          <div className="max-w-md space-y-4">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Welcome to My Ecommerce</h2>
            <p className="text-neutral-600">Discover the latest products at the best prices.</p>
            <Button
              asChild
              variant="default"
              className="inline-flex items-center justify-center rounded-full bg-black px-6 py-3 text-white"
            >
              <Link href="/products" className="inline-flex items-center justify-center rounded-full px-6 py-3">
                Browse All Products
              </Link>
            </Button>
          </div>
          {hero?.imageUrl && (
            <Image alt={hero.name} src={hero.imageUrl} className="rounded" width={450} height={450} />
          )}
        </div>
      </section>
      <section className="py-8">
        {products.length > 0 ? (
          <Carousel products={products} />
        ) : (
          <p className="text-center text-neutral-600">No products available yet. Please check back soon.</p>
        )}
      </section>
    </div>
  );
}
