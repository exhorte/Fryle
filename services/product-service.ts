import type { Prisma } from "@/generated/prisma/client";
import type { CategoryValue, SortValue } from "@/lib/catalog";
import { prisma } from "@/lib/db";

/** Données produit sérialisables, prêtes à être passées aux composants client. */
export type ProductView = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  category: CategoryValue;
  brand: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  currency: string;
  stock: number;
  featured: boolean;
  highlights: string[];
};

const select = {
  id: true,
  name: true,
  description: true,
  imageUrl: true,
  category: true,
  brand: true,
  priceCents: true,
  compareAtPriceCents: true,
  currency: true,
  stock: true,
  featured: true,
  highlights: true,
} as const;

const ORDER_BY: Record<SortValue, Prisma.ProductOrderByWithRelationInput[]> = {
  pertinence: [{ featured: "desc" }, { createdAt: "asc" }],
  "prix-croissant": [{ priceCents: "asc" }],
  "prix-decroissant": [{ priceCents: "desc" }],
  nouveautes: [{ createdAt: "desc" }],
};

export type ProductFilters = {
  category?: CategoryValue;
  query?: string;
  /** Uniquement les produits avec un prix barré. */
  onSale?: boolean;
  sort?: SortValue;
  limit?: number;
};

export function listProducts({ category, query, onSale, sort = "pertinence", limit }: ProductFilters = {}): Promise<ProductView[]> {
  const q = query?.trim().slice(0, 100);
  return prisma.product.findMany({
    where: {
      active: true,
      ...(category && { category }),
      ...(onSale && { compareAtPriceCents: { not: null } }),
      ...(q && {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { brand: { contains: q, mode: "insensitive" } },
        ],
      }),
    },
    orderBy: [...ORDER_BY[sort], { id: "asc" }],
    take: limit,
    select,
  });
}

/** Produits mis en avant (page d'accueil). */
export function listFeaturedProducts(limit = 8): Promise<ProductView[]> {
  return prisma.product.findMany({
    where: { active: true, featured: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit,
    select,
  });
}

/** Produits en promotion (prix barré), triés par réduction la plus forte. */
export async function listDeals(limit = 8): Promise<ProductView[]> {
  const deals = await prisma.product.findMany({
    where: { active: true, compareAtPriceCents: { not: null }, stock: { gt: 0 } },
    select,
  });
  const ratio = (p: ProductView) => p.priceCents / (p.compareAtPriceCents ?? p.priceCents);
  return deals.sort((a, b) => ratio(a) - ratio(b) || a.id.localeCompare(b.id)).slice(0, limit);
}

export function listRelatedProducts(product: Pick<ProductView, "id" | "category">, limit = 4): Promise<ProductView[]> {
  return prisma.product.findMany({
    where: { active: true, category: product.category, id: { not: product.id } },
    orderBy: [{ featured: "desc" }, { createdAt: "asc" }, { id: "asc" }],
    take: limit,
    select,
  });
}

/** Nombre de produits actifs par catégorie. */
export async function countProductsByCategory(): Promise<Partial<Record<CategoryValue, number>>> {
  const rows = await prisma.product.groupBy({ by: ["category"], where: { active: true }, _count: { _all: true } });
  return Object.fromEntries(rows.map((row) => [row.category, row._count._all]));
}

export function getActiveProduct(id: string): Promise<ProductView | null> {
  return prisma.product.findFirst({ where: { id, active: true }, select });
}
