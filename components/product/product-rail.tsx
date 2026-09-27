"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/** Rangée horizontale défilante (accrochage CSS), avec flèches de navigation. */
export function ProductRail({ children, label }: { children: React.ReactNode; label: string }) {
  const ref = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () =>
      setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const scroll = (direction: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <ul
        ref={ref}
        aria-label={label}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0"
      >
        {children}
      </ul>
      <div className="mt-6 hidden justify-end gap-2 md:flex">
        <Button variant="outline" size="icon" className="rounded-full" onClick={() => scroll(-1)} disabled={edges.start} aria-label="Produits précédents">
          <ArrowLeft />
        </Button>
        <Button size="icon" className="rounded-full" onClick={() => scroll(1)} disabled={edges.end} aria-label="Produits suivants">
          <ArrowRight />
        </Button>
      </div>
    </div>
  );
}

export function RailItem({ children }: { children: React.ReactNode }) {
  return <li className="w-[68%] shrink-0 snap-start sm:w-[42%] md:w-[31%] xl:w-[calc(25%-12px)]">{children}</li>;
}
