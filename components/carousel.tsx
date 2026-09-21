"use client";

import { useEffect, useState } from "react";
import type { ProductView } from "@/services/product-service";
import { formatMoney } from "@/lib/money";
import { Card, CardContent, CardTitle } from "./ui/card";
import { ProductImage } from "./product-image";

interface Props {
  products: ProductView[];
}

export const Carousel = ({ products }: Props) => {
  const [current, setCurrent] = useState<number>(0);

  useEffect(() => {
    if (products.length < 2) return;
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % products.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [products.length]);

  const currentProduct = products[current];
  if (!currentProduct) return null;

  return (
    <Card className="relative overflow-hidden rounded-lg border-gray-300 py-0 shadow-md">
      <div className="relative h-80 w-full">
        <ProductImage
          src={currentProduct.imageUrl}
          alt={currentProduct.name}
          sizes="(min-width: 1024px) 1024px, 100vw"
          className="transition-opacity duration-500 ease-in-out"
        />
      </div>
      <CardContent className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
        <CardTitle className="mb-2 text-3xl font-bold text-white">{currentProduct.name}</CardTitle>
        <p className="text-xl text-white">{formatMoney(currentProduct.priceCents, currentProduct.currency)}</p>
      </CardContent>
    </Card>
  );
};
