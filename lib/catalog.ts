// Catégories de la boutique. Fichier sans dépendance serveur : utilisable partout.

export type CategoryValue = "SMARTPHONE" | "LAPTOP" | "WATCH" | "EARBUDS" | "HEADPHONES" | "ACCESSORY";

export type CategoryInfo = {
  value: CategoryValue;
  /** Segment d'URL : /products?categorie=<slug> */
  slug: string;
  label: string;
  description: string;
  image: string;
};

export const CATEGORIES: CategoryInfo[] = [
  {
    value: "SMARTPHONE",
    slug: "smartphones",
    label: "Smartphones",
    description: "iPhone dernière génération, toutes capacités.",
    image: "/products/iphone-17-pro-orange.svg",
  },
  {
    value: "LAPTOP",
    slug: "ordinateurs",
    label: "Ordinateurs",
    description: "MacBook Air et MacBook Pro avec puces Apple.",
    image: "/products/macbook-air-midnight.svg",
  },
  {
    value: "WATCH",
    slug: "montres",
    label: "Montres",
    description: "Apple Watch pour le sport, la santé et le quotidien.",
    image: "/products/apple-watch-ultra-3.svg",
  },
  {
    value: "EARBUDS",
    slug: "ecouteurs",
    label: "Écouteurs",
    description: "AirPods avec réduction de bruit et audio spatial.",
    image: "/products/airpods-pro-3.svg",
  },
  {
    value: "HEADPHONES",
    slug: "casques",
    label: "Casques",
    description: "Casques circum-auriculaires à réduction de bruit.",
    image: "/products/airpods-max-midnight.svg",
  },
  {
    value: "ACCESSORY",
    slug: "accessoires",
    label: "Accessoires",
    description: "Chargeurs, câbles, coques et AirTag.",
    image: "/products/magsafe-charger.svg",
  },
];

export function categoryBySlug(slug: string | undefined): CategoryInfo | undefined {
  return CATEGORIES.find((category) => category.slug === slug);
}

export function categoryByValue(value: string): CategoryInfo {
  return CATEGORIES.find((category) => category.value === value) ?? CATEGORIES[CATEGORIES.length - 1];
}

export const SORT_OPTIONS = [
  { value: "pertinence", label: "Sélection Fryle" },
  { value: "prix-croissant", label: "Prix croissant" },
  { value: "prix-decroissant", label: "Prix décroissant" },
  { value: "nouveautes", label: "Nouveautés" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export function parseSort(value: string | undefined): SortValue {
  return SORT_OPTIONS.some((option) => option.value === value) ? (value as SortValue) : "pertinence";
}

/** Pourcentage de réduction arrondi, ou null s'il n'y a pas de prix barré valide. */
export function discountPercent(priceCents: number, compareAtPriceCents: number | null): number | null {
  if (!compareAtPriceCents || compareAtPriceCents <= priceCents) return null;
  return Math.round((1 - priceCents / compareAtPriceCents) * 100);
}
