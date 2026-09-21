"use client";

import type { ProductView } from "@/services/product-service";
import { useHydrated } from "@/hooks/use-hydrated";
import { MAX_QUANTITY_PER_PRODUCT } from "@/lib/limits";
import { formatMoney } from "@/lib/money";
import { useCartStore } from "@/store/cart-store";
import { Button } from "./ui/button";
import { ProductImage } from "./product-image";

interface Props {
  product: ProductView;
}

export const ProductDetail = ({ product }: Props) => {
  const { items, addItem, removeItem } = useCartStore();
  const hydrated = useHydrated();
  const cartItem = items.find((item) => item.id === product.id);
  const quantity = hydrated && cartItem ? cartItem.quantity : 0;
  const maxQuantity = Math.min(product.stock, MAX_QUANTITY_PER_PRODUCT);
  const soldOut = product.stock === 0;

  const onAddItem = () => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.priceCents,
      currency: product.currency,
      imageUrl: product.imageUrl,
      quantity: 1,
    });
  };

  return (
    <div className="container mx-auto flex flex-col items-center gap-8 px-4 py-8 md:flex-row">
      <div className="relative h-96 w-full overflow-hidden rounded-lg md:w-1/2">
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          sizes="(min-width: 768px) 50vw, 100vw"
          className="transition duration-300 hover:opacity-90"
        />
      </div>
      <div className="md:w-1/2">
        <h1 className="mb-4 text-3xl font-bold">{product.name}</h1>
        {product.description && <p className="mb-4 text-gray-700">{product.description}</p>}
        <p className="mb-4 text-lg font-semibold text-gray-900">{formatMoney(product.priceCents, product.currency)}</p>
        {soldOut ? (
          <p className="font-medium text-red-600">Out of stock</p>
        ) : (
          <div className="flex items-center space-x-4">
            <Button variant="outline" aria-label="Remove one" disabled={quantity === 0} onClick={() => removeItem(product.id)}>
              –
            </Button>
            <span className="text-lg font-semibold">{quantity}</span>
            <Button aria-label="Add one" disabled={quantity >= maxQuantity} onClick={onAddItem}>
              +
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
