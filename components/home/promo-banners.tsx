import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const BANNERS = [
  {
    eyebrow: "MacBook Air et MacBook Pro",
    title: "Créez sans limite.",
    text: "La puissance des puces Apple, une autonomie qui tient toute la journée.",
    cta: "Voir les ordinateurs",
    href: "/products?categorie=ordinateurs",
    image: "/products/macbook-pro-space-black.svg",
    dark: true,
  },
  {
    eyebrow: "Casques et écouteurs",
    title: "Le son, sans compromis.",
    text: "Réduction de bruit active, audio spatial, confort pour des heures d'écoute.",
    cta: "Voir l'audio",
    href: "/products?categorie=casques",
    image: "/products/airpods-max-blue.svg",
    dark: false,
  },
];

export function PromoBanners() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {BANNERS.map((banner) => (
        <Link
          key={banner.href}
          href={banner.href}
          className={cn(
            "group relative isolate flex min-h-80 overflow-hidden rounded-3xl p-8 sm:p-10",
            banner.dark ? "bg-foreground text-background" : "bg-surface",
          )}
        >
          <div className="relative z-10 flex max-w-[55%] flex-col justify-between gap-6">
            <div className="space-y-3">
              <p className={cn("text-xs font-medium tracking-wide uppercase", banner.dark ? "text-background/60" : "text-muted-foreground")}>
                {banner.eyebrow}
              </p>
              <h3 className="text-3xl font-semibold sm:text-4xl">{banner.title}</h3>
              <p className={cn("text-sm", banner.dark ? "text-background/70" : "text-muted-foreground")}>{banner.text}</p>
            </div>
            <span
              className={cn(
                "inline-flex w-fit items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors",
                banner.dark ? "bg-background text-foreground" : "bg-foreground text-background",
              )}
            >
              {banner.cta} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
          <div className="absolute inset-y-0 -right-10 w-[60%] sm:-right-6">
            <Image
              src={banner.image}
              alt=""
              fill
              sizes="(min-width: 1024px) 380px, 55vw"
              className="object-contain transition-transform duration-700 group-hover:scale-105"
            />
          </div>
        </Link>
      ))}
    </div>
  );
}
