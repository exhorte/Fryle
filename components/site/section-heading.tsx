import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
  className?: string;
}

export function SectionHeading({ title, description, href, linkLabel = "Tout voir", className }: Props) {
  return (
    <div className={cn("mb-8 flex items-end justify-between gap-6", className)}>
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold md:text-4xl">{title}</h2>
        {description && <p className="max-w-xl text-muted-foreground">{description}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="group flex shrink-0 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {linkLabel}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
