import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/** Recherche du catalogue : simple formulaire GET, fonctionne même sans JavaScript. */
export function SearchForm({ className, defaultValue }: { className?: string; defaultValue?: string }) {
  return (
    <form action="/products" role="search" className={cn("relative", className)}>
      <label htmlFor="site-search" className="sr-only">
        Rechercher un produit
      </label>
      <input
        id="site-search"
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder="Rechercher un iPhone, un Mac, des AirPods…"
        className="h-11 w-full rounded-full border border-transparent bg-muted pr-12 pl-5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:bg-background focus-visible:ring-[3px] focus-visible:ring-ring/30"
      />
      <button
        type="submit"
        aria-label="Lancer la recherche"
        className="absolute top-1.5 right-1.5 flex size-8 items-center justify-center rounded-full bg-foreground text-background transition-opacity hover:opacity-85"
      >
        <Search className="size-4" />
      </button>
    </form>
  );
}
