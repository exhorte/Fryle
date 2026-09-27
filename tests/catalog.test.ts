import { beforeEach, describe, expect, it } from "vitest";
import { categoryBySlug, discountPercent, parseSort } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { subscribeToNewsletter } from "@/services/newsletter-service";
import {
  countProductsByCategory,
  getActiveProduct,
  listDeals,
  listFeaturedProducts,
  listProducts,
  listRelatedProducts,
} from "@/services/product-service";
import { createProduct, resetDb } from "./helpers";

beforeEach(async () => {
  await resetDb();
  await prisma.newsletterSubscriber.deleteMany();
});

async function seedCatalog() {
  await createProduct({ id: "phone-a", name: "iPhone 17 Pro", category: "SMARTPHONE", priceCents: 159900, featured: true });
  await createProduct({ id: "phone-b", name: "iPhone 17", category: "SMARTPHONE", priceCents: 112900, compareAtPriceCents: 119900 });
  await createProduct({ id: "mac-a", name: "MacBook Air", category: "LAPTOP", priceCents: 139900, compareAtPriceCents: 149900, description: "Portable ultra-fin" });
  await createProduct({ id: "buds", name: "AirPods Pro", category: "EARBUDS", priceCents: 32900, featured: true });
  await createProduct({ id: "old", name: "Ancien iPhone", category: "SMARTPHONE", priceCents: 50000, active: false });
  await createProduct({ id: "headset", name: "Sony WH-1000XM6", brand: "Sony", category: "HEADPHONES", priceCents: 54999, compareAtPriceCents: 59999, stock: 0 });
}

describe("catalogue : outils", () => {
  it("résout les catégories par slug", () => {
    expect(categoryBySlug("smartphones")?.value).toBe("SMARTPHONE");
    expect(categoryBySlug("inconnue")).toBeUndefined();
    expect(categoryBySlug(undefined)).toBeUndefined();
  });

  it("n'accepte que les tris connus", () => {
    expect(parseSort("prix-croissant")).toBe("prix-croissant");
    expect(parseSort("n'importe quoi")).toBe("pertinence");
  });

  it("calcule le pourcentage de réduction, seulement si le prix barré est supérieur", () => {
    expect(discountPercent(112900, 119900)).toBe(6);
    expect(discountPercent(7500, 10000)).toBe(25);
    expect(discountPercent(10000, null)).toBeNull();
    expect(discountPercent(10000, 10000)).toBeNull();
  });
});

describe("catalogue : requêtes", () => {
  it("filtre par catégorie et exclut les produits inactifs", async () => {
    await seedCatalog();
    const phones = await listProducts({ category: "SMARTPHONE" });
    expect(phones.map((p) => p.id).sort()).toEqual(["phone-a", "phone-b"]);
  });

  it("recherche dans le nom, la description et la marque, sans tenir compte de la casse", async () => {
    await seedCatalog();
    expect((await listProducts({ query: "iphone" })).map((p) => p.id).sort()).toEqual(["phone-a", "phone-b"]);
    expect((await listProducts({ query: "ULTRA-FIN" })).map((p) => p.id)).toEqual(["mac-a"]);
    expect((await listProducts({ query: "sony" })).map((p) => p.id)).toEqual(["headset"]);
    expect(await listProducts({ query: "introuvable" })).toEqual([]);
  });

  it("trie par prix et met les produits en avant en premier par défaut", async () => {
    await seedCatalog();
    const asc = (await listProducts({ sort: "prix-croissant" })).map((p) => p.priceCents);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    const desc = (await listProducts({ sort: "prix-decroissant" })).map((p) => p.priceCents);
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
    const featuredFirst = await listProducts();
    expect(featuredFirst.slice(0, 2).every((p) => p.featured)).toBe(true);
  });

  it("bons plans : seulement les prix barrés ; la mise en avant de l'accueil exclut les ruptures", async () => {
    await seedCatalog();
    expect((await listProducts({ onSale: true })).map((p) => p.id).sort()).toEqual(["headset", "mac-a", "phone-b"]);
    // Tri par réduction décroissante : Mac -7 % puis iPhone -6 % ; le casque est épuisé.
    expect((await listDeals()).map((p) => p.id)).toEqual(["mac-a", "phone-b"]);
  });

  it("produits mis en avant, similaires et décompte par catégorie", async () => {
    await seedCatalog();
    expect((await listFeaturedProducts()).map((p) => p.id).sort()).toEqual(["buds", "phone-a"]);
    expect((await listRelatedProducts({ id: "phone-a", category: "SMARTPHONE" })).map((p) => p.id)).toEqual(["phone-b"]);
    expect(await countProductsByCategory()).toEqual({ SMARTPHONE: 2, LAPTOP: 1, EARBUDS: 1, HEADPHONES: 1 });
  });

  it("un produit inactif n'est pas consultable", async () => {
    await seedCatalog();
    expect(await getActiveProduct("old")).toBeNull();
    expect((await getActiveProduct("phone-a"))?.name).toBe("iPhone 17 Pro");
  });

  it("la base refuse un prix barré inférieur ou égal au prix de vente", async () => {
    await expect(createProduct({ priceCents: 10000, compareAtPriceCents: 9000 })).rejects.toThrow();
    await expect(createProduct({ priceCents: 10000, compareAtPriceCents: 10000 })).rejects.toThrow();
  });
});

describe("newsletter", () => {
  it("inscrit une adresse normalisée, une seule fois", async () => {
    expect(await subscribeToNewsletter("  Client@Exemple.COM ")).toEqual({ ok: true });
    expect(await subscribeToNewsletter("client@exemple.com")).toEqual({ ok: true });
    const rows = await prisma.newsletterSubscriber.findMany();
    expect(rows.map((r) => r.email)).toEqual(["client@exemple.com"]);
  });

  it.each([["pas-un-email"], [""], [null], [42], ["a".repeat(250) + "@x.com"]])("refuse une adresse invalide (%s)", async (value) => {
    expect(await subscribeToNewsletter(value)).toEqual({ ok: false, error: "Adresse e-mail invalide." });
    expect(await prisma.newsletterSubscriber.count()).toBe(0);
  });
});
