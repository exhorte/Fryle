import { Suspense } from "react";
import { CartButton } from "@/components/cart/cart-button";
import { AccountMenu } from "./account-menu";
import { Logo } from "./logo";
import { MobileNav } from "./mobile-nav";
import { NavLinks, NavLinksFallback } from "./nav-links";
import { SearchForm } from "./search-form";

export function SiteHeader({ authEnabled }: { authEnabled: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:h-20 lg:gap-8 lg:px-8">
        <MobileNav authEnabled={authEnabled} />
        <Logo className="shrink-0" />
        <SearchForm className="mx-auto hidden w-full max-w-xl md:block" />
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          {authEnabled && <AccountMenu />}
          <CartButton />
        </div>
      </div>
      <div className="px-4 pb-3 md:hidden">
        <SearchForm />
      </div>
      <div className="mx-auto hidden max-w-7xl px-8 lg:block">
        <Suspense fallback={<NavLinksFallback />}>
          <NavLinks />
        </Suspense>
      </div>
    </header>
  );
}
