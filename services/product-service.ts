import { prisma } from "@/lib/db";

/** Données produit sérialisables, prêtes à être passées aux composants client. */
export type ProductView = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  priceCents: number;
  currency: string;
  stock: number;
};

const select = {
  id: true,
  name: true,
  description: true,
  imageUrl: true,
  priceCents: true,
  currency: true,
  stock: true,
} as const;

export function listActiveProducts(limit?: number): Promise<ProductView[]> {
  return prisma.product.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
    take: limit,
    select,
  });
}

export function getActiveProduct(id: string): Promise<ProductView | null> {
  return prisma.product.findFirst({ where: { id, active: true }, select });
}
