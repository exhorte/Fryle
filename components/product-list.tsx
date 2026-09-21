"use client";

import { useState } from "react";
import type { ProductView } from "@/services/product-service";
import { ProductCard } from "./product-card";

interface Props {
  products: ProductView[];
}

export const ProductList = ({ products }: Props) => {
  const [searchTerm, setSearchTerm] = useState<string>("");

  const term = searchTerm.toLowerCase();
  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(term) || (product.description?.toLowerCase().includes(term) ?? false),
  );

  return (
    <div>
      <div className="mb-6 flex justify-center">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search products..."
          aria-label="Search products"
          className="w-full max-w-md rounded border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {filteredProducts.length === 0 ? (
        <p className="text-center text-gray-600">No products found.</p>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product) => (
            <li key={product.id}>
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
