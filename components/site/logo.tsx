import Link from "next/link";
import { cn } from "@/lib/utils";

/** Emblème Fryle : « f » blanc sur carré noir, point d'accent bleu. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      <rect width="32" height="32" rx="9" className="fill-foreground" />
      <path
        d="M13 25.5V12.8a5.3 5.3 0 0 1 5.3-5.3h2.2M9 15.2h9"
        fill="none"
        className="stroke-background"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle cx="22.6" cy="24" r="2.4" className="fill-brand" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label="Fryle, accueil" className={cn("flex items-center gap-2", className)}>
      <LogoMark />
      <span className="font-display text-2xl leading-none font-bold tracking-tight">fryle</span>
    </Link>
  );
}
