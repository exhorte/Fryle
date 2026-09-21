import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/product-detail";
import { getActiveProduct } from "@/services/product-service";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getActiveProduct(id);
  if (!product) notFound();

  return <ProductDetail product={product} />;
}
