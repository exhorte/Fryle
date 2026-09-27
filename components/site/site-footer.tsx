import Link from "next/link";
import { Lock, Mail } from "lucide-react";
import { CATEGORIES } from "@/lib/catalog";
import { siteConfig } from "@/lib/site-config";
import { LogoMark } from "./logo";

export function SiteFooter({ authEnabled }: { authEnabled: boolean }) {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-24 border-t bg-muted/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-8">
        <div className="space-y-4">
          <Link href="/" className="flex items-center gap-2">
            <LogoMark />
            <span className="font-display text-2xl font-bold tracking-tight">fryle</span>
          </Link>
          <p className="max-w-xs text-sm text-muted-foreground">{siteConfig.description}</p>
          {siteConfig.supportEmail && (
            <a
              href={`mailto:${siteConfig.supportEmail}`}
              className="flex items-center gap-2 text-sm font-medium hover:underline"
            >
              <Mail className="size-4" /> {siteConfig.supportEmail}
            </a>
          )}
        </div>

        <FooterColumn title="Boutique">
          {CATEGORIES.map((category) => (
            <FooterLink key={category.slug} href={`/products?categorie=${category.slug}`}>
              {category.label}
            </FooterLink>
          ))}
        </FooterColumn>

        <FooterColumn title="Mon compte">
          <FooterLink href="/checkout">Mon panier</FooterLink>
          {authEnabled && <FooterLink href="/orders">Mes commandes</FooterLink>}
          {authEnabled && <FooterLink href="/login">Se connecter</FooterLink>}
        </FooterColumn>

        <FooterColumn title="Achetez sereinement">
          <li className="text-sm text-muted-foreground">Retours sous {siteConfig.returnDays} jours</li>
          <li className="text-sm text-muted-foreground">{siteConfig.warrantyLabel}</li>
          <li className="text-sm text-muted-foreground">Paiement sécurisé</li>
        </FooterColumn>
      </div>

      <div className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
          <p>© {year} Fryle. Tous droits réservés.</p>
          <p className="flex items-center gap-1.5">
            <Lock className="size-3.5" /> Paiements chiffrés et traités par Stripe
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-4 font-sans text-sm font-semibold tracking-normal">{title}</h2>
      <ul className="space-y-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
        {children}
      </Link>
    </li>
  );
}
