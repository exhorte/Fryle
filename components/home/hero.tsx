import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import type { ProductView } from "@/services/product-service";

/** Bandeau d'accueil : fond gris clair, grand filigrane « fryle », produit phare. */
export function Hero({ product }: { product: ProductView | null }) {
  return (
    <section className="relative isolate overflow-hidden rounded-3xl bg-surface">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -bottom-[0.2em] -z-10 text-center font-display text-[34vw] leading-none font-bold tracking-tighter text-foreground/[0.05] select-none lg:text-[30rem]"
      >
        fryle
      </span>

      <div className="grid items-center gap-6 px-6 pt-10 sm:px-10 lg:grid-cols-[1.05fr_1fr] lg:gap-4 lg:px-14 lg:pt-0">
        <div className="space-y-6 lg:py-20">
          <p className="inline-flex items-center gap-2 rounded-full bg-background px-3 py-1.5 text-xs font-medium shadow-sm">
            <span className="size-1.5 rounded-full bg-brand" aria-hidden />
            Nouveauté · {product?.name.split(" – ")[0] ?? "iPhone"}
          </p>
          <h1 className="text-5xl leading-[1.02] font-semibold sm:text-6xl lg:text-7xl">
            Passez à la
            <br />
            puissance supérieure.
          </h1>
          <p className="max-w-md text-lg text-muted-foreground">
            iPhone, Mac, Apple Watch, AirPods et accessoires : la technologie qui vous accompagne, livrée chez vous.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="h-12 rounded-full px-7 text-base">
              <Link href={product ? `/products/${product.id}` : "/products?categorie=smartphones"}>
                Découvrir l&apos;iPhone <ArrowRight />
              </Link>
            </Button>
            <Link
              href="/products"
              aria-label="Voir toute la boutique"
              className="flex size-12 items-center justify-center rounded-full border border-dashed border-foreground/40 transition-colors hover:border-solid hover:bg-background"
            >
              <ArrowUpRight className="size-5" />
            </Link>
            {product && (
              <p className="text-sm text-muted-foreground">
                À partir de <span className="font-semibold text-foreground">{formatMoney(product.priceCents, product.currency)}</span>
              </p>
            )}
          </div>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-[560px] lg:-mb-6">
          <Image
            src="/products/hero-iphone.svg"
            alt="Deux iPhone, vus de face et de dos"
            fill
            preload
            sizes="(min-width: 1024px) 560px, 90vw"
            className="object-contain drop-shadow-[0_40px_60px_rgb(0_0_0/0.12)]"
          />
        </div>
      </div>
    </section>
  );
}
