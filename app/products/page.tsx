import { ProductList } from "@/components/product-list";
import { listActiveProducts } from "@/services/product-service";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const products = await listActiveProducts();

  return (
    <div className="pb-8">
      <h1 className="mb-8 text-center text-3xl font-bold leading-none tracking-tight text-foreground">
        All Products
      </h1>
      <ProductList products={products} />
    </div>
  );
}
