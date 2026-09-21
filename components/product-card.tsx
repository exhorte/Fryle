import Link from "next/link";
import type { ProductView } from "@/services/product-service";
import { formatMoney } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { buttonVariants } from "./ui/button";
import { ProductImage } from "./product-image";

interface Props {
  product: ProductView;
}

export const ProductCard = ({ product }: Props) => {
  return (
    <Link href={`/products/${product.id}`} className="block h-full">
      <Card className="group flex h-full flex-col gap-0 border-gray-300 py-0 transition duration-300 hover:shadow-2xl">
        <div className="relative h-60 w-full overflow-hidden rounded-t-xl">
          <ProductImage
            src={product.imageUrl}
            alt={product.name}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="transition-opacity duration-300 group-hover:opacity-90"
          />
        </div>
        <CardHeader className="p-4">
          <CardTitle className="text-xl font-bold text-gray-800">{product.name}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-grow flex-col justify-between p-4">
          {product.description && <p className="mb-2 text-sm text-gray-600">{product.description}</p>}
          <p className="text-lg font-semibold text-gray-900">
            {formatMoney(product.priceCents, product.currency)}
            {product.stock === 0 && <span className="ml-2 text-sm font-normal text-red-600">Out of stock</span>}
          </p>
          {/* Visuel seulement : la carte entière est le lien (un bouton dans un lien est du HTML invalide). */}
          <span className={buttonVariants({ className: "mt-4 bg-black text-white" })}>View Details</span>
        </CardContent>
      </Card>
    </Link>
  );
};
