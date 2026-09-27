import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { AnnouncementBar } from "@/components/site/announcement-bar";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { enabledProviders } from "@/lib/auth-config";
import { siteConfig } from "@/lib/site-config";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Fryle · iPhone, Mac, Apple Watch et audio", template: "%s · Fryle" },
  description: siteConfig.description,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const authEnabled = enabledProviders().length > 0;
  return (
    <html lang="fr" className={`${inter.variable} ${outfit.variable}`}>
      <body className="flex min-h-dvh flex-col font-sans">
        <a
          href="#contenu"
          className="sr-only z-50 rounded-full bg-foreground px-4 py-2 text-background focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Aller au contenu
        </a>
        <AnnouncementBar />
        <SiteHeader authEnabled={authEnabled} />
        <main id="contenu" className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8">
          {children}
        </main>
        <SiteFooter authEnabled={authEnabled} />
        <CartDrawer />
      </body>
    </html>
  );
}
