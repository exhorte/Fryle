import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="relative isolate mx-auto flex max-w-xl flex-col items-center overflow-hidden py-20 text-center">
      <span aria-hidden className="absolute top-0 -z-10 font-display text-[10rem] leading-none font-bold text-foreground/5">
        404
      </span>
      <h1 className="mt-16 mb-3 text-4xl font-semibold">Page introuvable</h1>
      <p className="mb-8 text-muted-foreground">Ce produit ou cette page n&apos;existe pas, ou n&apos;est plus disponible.</p>
      <div className="flex gap-3">
        <Button asChild size="lg" className="rounded-full">
          <Link href="/products">Voir la boutique</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="rounded-full">
          <Link href="/">Accueil</Link>
        </Button>
      </div>
    </div>
  );
}
