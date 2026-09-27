import Image from "next/image";
import Link from "next/link";
import { CATEGORIES, type CategoryValue } from "@/lib/catalog";

export function CategoryGrid({ counts }: { counts: Partial<Record<CategoryValue, number>> }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {CATEGORIES.map((category) => {
        const count = counts[category.value] ?? 0;
        return (
          <li key={category.slug}>
            <Link
              href={`/products?categorie=${category.slug}`}
              className="group flex h-full flex-col items-center rounded-2xl bg-surface p-4 pb-5 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_-16px_rgb(0_0_0/0.25)]"
            >
              <span className="relative mb-3 aspect-square w-full">
                <Image
                  src={category.image}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 180px, 45vw"
                  className="object-contain transition-transform duration-500 group-hover:scale-105"
                />
              </span>
              <span className="font-medium">{category.label}</span>
              <span className="text-xs text-muted-foreground">
                {count} produit{count > 1 ? "s" : ""}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
