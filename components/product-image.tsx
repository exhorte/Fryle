import Image from "next/image";
import { cn } from "@/lib/utils";

interface Props {
  src: string | null;
  alt: string;
  sizes?: string;
  className?: string;
}

/** Remplit son parent (qui doit être `relative` et avoir une taille). Repli neutre sans image. */
export const ProductImage = ({ src, alt, sizes, className }: Props) => {
  if (!src) {
    return (
      <div
        aria-hidden
        className="flex h-full w-full items-center justify-center bg-neutral-100 text-5xl font-bold text-neutral-300"
      >
        {alt.charAt(0).toUpperCase()}
      </div>
    );
  }
  return <Image src={src} alt={alt} fill sizes={sizes} className={cn("object-cover", className)} />;
};
