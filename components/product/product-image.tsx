import Image from "next/image";
import { Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  src: string | null;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
}

/**
 * Visuel produit centré sur son fond (le parent doit être `relative` et avoir une taille).
 * Les images restent entières (object-contain) : pas de recadrage des appareils.
 */
export function ProductImage({ src, alt, sizes, priority, className }: Props) {
  if (!src) {
    return (
      <div aria-hidden className="flex h-full w-full items-center justify-center text-muted-foreground/40">
        <Smartphone className="size-1/4" strokeWidth={1.2} />
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      preload={priority}
      className={cn("object-contain p-[8%] transition-transform duration-500 ease-out", className)}
    />
  );
}
