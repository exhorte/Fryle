"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { BadgePercent, ChevronRight, Menu, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CATEGORIES } from "@/lib/catalog";
import { LogoMark } from "./logo";

export function MobileNav({ authEnabled }: { authEnabled: boolean }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full lg:hidden" aria-label="Ouvrir le menu">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-full gap-0 p-0 sm:max-w-sm">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle className="flex items-center gap-2 font-display text-xl">
            <LogoMark className="size-7" /> fryle
          </SheetTitle>
          <SheetDescription className="sr-only">Navigation principale</SheetDescription>
        </SheetHeader>
        <nav aria-label="Catégories" className="flex-1 overflow-y-auto px-3 py-3">
          <ul>
            <li>
              <Link href="/products" onClick={close} className="flex items-center justify-between rounded-xl px-3 py-3 font-medium hover:bg-muted">
                Toute la boutique <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            </li>
            {CATEGORIES.map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/products?categorie=${category.slug}`}
                  onClick={close}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 font-medium hover:bg-muted"
                >
                  <span className="relative size-11 shrink-0 rounded-lg bg-surface">
                    <Image src={category.image} alt="" fill sizes="44px" className="object-contain p-1" />
                  </span>
                  <span className="flex-1">{category.label}</span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
            <li>
              <Link href="/products?promo=1" onClick={close} className="flex items-center gap-3 rounded-xl px-3 py-3 font-medium text-sale hover:bg-muted">
                <BadgePercent className="size-5" /> Bons plans
              </Link>
            </li>
            {authEnabled && (
            <li>
              <Link href="/orders" onClick={close} className="flex items-center gap-3 rounded-xl px-3 py-3 font-medium hover:bg-muted">
                <Package className="size-5" /> Mes commandes
              </Link>
            </li>
            )}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
