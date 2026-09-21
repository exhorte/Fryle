"use client";

import Link from "next/link";
import { Menu, ShoppingCart, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import { useCartStore } from "@/store/cart-store";
import { AuthMenu } from "./auth-menu";
import { Button } from "./ui/button";

export const Navbar = ({ authEnabled = false }: { authEnabled?: boolean }) => {
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const { items } = useCartStore();
  const hydrated = useHydrated();
  // Le panier vit dans le localStorage : on ne l'affiche qu'après hydratation.
  const cartCount = hydrated ? items.reduce((acc, item) => acc + item.quantity, 0) : 0;

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <nav className="sticky top-0 z-50 bg-white shadow">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <Link href="/" className="hover:text-blue-600">
          My Ecommerce
        </Link>
        <div className="hidden space-x-6 md:flex">
          <Link href="/">Home</Link>
          <Link href="/products" className="hover:text-blue-600">
            Products
          </Link>
          <Link href="/checkout" className="hover:text-blue-600">
            Checkout
          </Link>
        </div>
        <div className="flex items-center space-x-4">
          {authEnabled && <AuthMenu />}
          <Link href="/checkout" className="relative" aria-label={`Cart, ${cartCount} items`}>
            <ShoppingCart className="h-6 w-6" />
            {cartCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                {cartCount}
              </span>
            )}
          </Link>
          <Button
            variant="ghost"
            className="md:hidden"
            aria-label="Toggle menu"
            onClick={() => setMobileOpen((prev) => !prev)}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>
      {mobileOpen && (
        <nav className="bg-white shadow-md md:hidden">
          <ul className="flex flex-col space-y-2 p-4">
            <li>
              <Link href="/" className="block hover:text-blue-600">
                Home
              </Link>
            </li>
            <li>
              <Link href="/products" className="block hover:text-blue-600">
                Products
              </Link>
            </li>
            <li>
              <Link href="/checkout" className="block hover:text-blue-600">
                Checkout
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </nav>
  );
};
