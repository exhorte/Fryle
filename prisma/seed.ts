import "dotenv/config";
import type { Category } from "../generated/prisma/client";
import { prisma } from "../lib/db";

// Catalogue de démonstration Fryle. Idempotent : un produit déjà présent n'est jamais modifié
// (la base fait foi). Prix en centimes CAD (159900 = 1 599,00 $).
//
// ⚠ Données d'exemple : vérifiez prix, caractéristiques et stock, et remplacez les illustrations
//   (public/products/*.svg) par vos propres photos avant la mise en ligne.

type SeedProduct = {
  id: string;
  name: string;
  category: Category;
  brand?: string;
  description: string;
  priceCents: number;
  compareAtPriceCents?: number;
  stock: number;
  featured?: boolean;
  highlights: string[];
  image: string;
};

const products: SeedProduct[] = [
  // --- Smartphones
  {
    id: "iphone-17-pro-orange",
    name: "iPhone 17 Pro 256 Go – Orange cosmique",
    category: "SMARTPHONE",
    description:
      "Le plus puissant des iPhone, avec un boîtier en aluminium, un triple appareil photo pro et une autonomie taillée pour les longues journées.",
    priceCents: 159900,
    stock: 14,
    featured: true,
    highlights: ["Puce A19 Pro", "Écran 6,3 po ProMotion", "Triple appareil photo 48 Mpx", "USB‑C et MagSafe"],
    image: "iphone-17-pro-orange",
  },
  {
    id: "iphone-17-pro-argent",
    name: "iPhone 17 Pro 256 Go – Argent",
    category: "SMARTPHONE",
    description: "Toute la puissance de l'iPhone 17 Pro dans une finition argent lumineuse.",
    priceCents: 159900,
    stock: 9,
    highlights: ["Puce A19 Pro", "Écran 6,3 po ProMotion", "Triple appareil photo 48 Mpx", "USB‑C et MagSafe"],
    image: "iphone-17-pro-silver",
  },
  {
    id: "iphone-17-pro-max-bleu",
    name: "iPhone 17 Pro Max 256 Go – Bleu intense",
    category: "SMARTPHONE",
    description: "Le grand écran de 6,9 pouces et la meilleure autonomie jamais vue sur un iPhone.",
    priceCents: 174900,
    stock: 4,
    featured: true,
    highlights: ["Puce A19 Pro", "Écran 6,9 po ProMotion", "Triple appareil photo 48 Mpx", "Autonomie record"],
    image: "iphone-17-pro-max-blue",
  },
  {
    id: "iphone-air-bleu-ciel",
    name: "iPhone Air 256 Go – Bleu ciel",
    category: "SMARTPHONE",
    description: "L'iPhone le plus fin jamais conçu, sans compromis sur la puissance.",
    priceCents: 139900,
    stock: 11,
    highlights: ["Puce A19 Pro", "Écran 6,5 po ProMotion", "Design ultra-fin", "Appareil photo Fusion 48 Mpx"],
    image: "iphone-air-sky",
  },
  {
    id: "iphone-17-lavande",
    name: "iPhone 17 256 Go – Lavande",
    category: "SMARTPHONE",
    description: "Un iPhone complet et coloré, avec écran ProMotion et double appareil photo 48 Mpx.",
    priceCents: 112900,
    compareAtPriceCents: 119900,
    stock: 18,
    featured: true,
    highlights: ["Puce A19", "Écran 6,3 po ProMotion", "Double appareil photo 48 Mpx", "USB‑C et MagSafe"],
    image: "iphone-17-lavender",
  },
  // --- Ordinateurs
  {
    id: "macbook-air-13-m4-minuit",
    name: "MacBook Air 13 po puce M4 – Minuit",
    category: "LAPTOP",
    description: "Léger, silencieux et endurant : le portable idéal pour étudier, travailler et créer.",
    priceCents: 139900,
    compareAtPriceCents: 149900,
    stock: 7,
    featured: true,
    highlights: ["Puce M4", "16 Go de mémoire unifiée", "SSD 256 Go", "Jusqu'à 18 h d'autonomie"],
    image: "macbook-air-midnight",
  },
  {
    id: "macbook-air-15-m4-lumiere",
    name: "MacBook Air 15 po puce M4 – Lumière stellaire",
    category: "LAPTOP",
    description: "Plus d'écran pour vos fenêtres et vos projets, dans un châssis toujours aussi fin.",
    priceCents: 169900,
    stock: 5,
    highlights: ["Puce M4", "Écran Liquid Retina 15,3 po", "16 Go de mémoire unifiée", "SSD 256 Go"],
    image: "macbook-air-starlight",
  },
  {
    id: "macbook-pro-14-m5-noir",
    name: "MacBook Pro 14 po puce M5 – Noir sidéral",
    category: "LAPTOP",
    description: "Des performances de pro pour le montage, le code et la 3D, avec un écran XDR éclatant.",
    priceCents: 219900,
    stock: 3,
    featured: true,
    highlights: ["Puce M5", "Écran Liquid Retina XDR", "16 Go de mémoire unifiée", "SSD 512 Go"],
    image: "macbook-pro-space-black",
  },
  // --- Montres
  {
    id: "apple-watch-series-11",
    name: "Apple Watch Series 11 GPS 46 mm",
    category: "WATCH",
    description: "Votre partenaire santé et forme au quotidien, avec un écran toujours allumé.",
    priceCents: 55900,
    stock: 12,
    featured: true,
    highlights: ["Suivi de la santé et du sommeil", "Écran toujours allumé", "Résistante à l'eau", "Autonomie toute la journée"],
    image: "apple-watch-series-11",
  },
  {
    id: "apple-watch-ultra-3",
    name: "Apple Watch Ultra 3",
    category: "WATCH",
    description: "Boîtier en titane, GPS double fréquence et bouton Action : taillée pour l'aventure.",
    priceCents: 109900,
    compareAtPriceCents: 114900,
    stock: 6,
    highlights: ["Boîtier en titane 49 mm", "GPS double fréquence", "Bouton Action", "Autonomie longue durée"],
    image: "apple-watch-ultra-3",
  },
  {
    id: "apple-watch-se-3",
    name: "Apple Watch SE 3 GPS 40 mm",
    category: "WATCH",
    description: "L'essentiel de l'Apple Watch à un prix accessible.",
    priceCents: 34900,
    stock: 20,
    highlights: ["Suivi de l'activité", "Détection des chutes", "Résistante à l'eau", "Notifications et Apple Pay"],
    image: "apple-watch-se-3",
  },
  // --- Écouteurs
  {
    id: "airpods-pro-3",
    name: "AirPods Pro 3",
    category: "EARBUDS",
    description: "Réduction active du bruit, audio spatial personnalisé et suivi de la fréquence cardiaque.",
    priceCents: 32900,
    stock: 25,
    featured: true,
    highlights: ["Réduction active du bruit", "Audio spatial personnalisé", "Étui de charge USB‑C", "Résistants à la sueur et à l'eau"],
    image: "airpods-pro-3",
  },
  {
    id: "airpods-4",
    name: "AirPods 4",
    category: "EARBUDS",
    description: "Le confort des AirPods, un son riche et un étui plus compact.",
    priceCents: 17900,
    stock: 30,
    highlights: ["Audio spatial personnalisé", "Étui de charge USB‑C", "Jusqu'à 30 h avec l'étui", "Connexion instantanée"],
    image: "airpods-4",
  },
  // --- Casques
  {
    id: "airpods-max-minuit",
    name: "AirPods Max – Minuit",
    category: "HEADPHONES",
    description: "Un son haute fidélité, une réduction de bruit de référence et un design tout en élégance.",
    priceCents: 77900,
    compareAtPriceCents: 82900,
    stock: 5,
    featured: true,
    highlights: ["Réduction active du bruit", "Audio spatial", "Coussinets en mousse à mémoire de forme", "Recharge USB‑C"],
    image: "airpods-max-midnight",
  },
  {
    id: "airpods-max-bleu",
    name: "AirPods Max – Bleu",
    category: "HEADPHONES",
    description: "L'expérience AirPods Max dans une teinte bleue apaisante.",
    priceCents: 77900,
    stock: 2,
    highlights: ["Réduction active du bruit", "Audio spatial", "Mode Transparence", "Recharge USB‑C"],
    image: "airpods-max-blue",
  },
  {
    id: "beats-studio-pro-sable",
    name: "Beats Studio Pro – Sable",
    category: "HEADPHONES",
    brand: "Beats",
    description: "Un son puissant, la réduction de bruit adaptative et jusqu'à 40 heures d'écoute.",
    priceCents: 44999,
    compareAtPriceCents: 49999,
    stock: 8,
    highlights: ["Réduction de bruit adaptative", "Jusqu'à 40 h d'autonomie", "Audio USB‑C sans perte", "Pliable"],
    image: "beats-studio-pro",
  },
  {
    id: "sony-wh-1000xm6-noir",
    name: "Sony WH-1000XM6 – Noir",
    category: "HEADPHONES",
    brand: "Sony",
    description: "Une réduction de bruit de premier plan et un confort pensé pour les longs trajets.",
    priceCents: 54999,
    stock: 0,
    highlights: ["Réduction de bruit avancée", "Jusqu'à 30 h d'autonomie", "Appels nets en toute situation", "Charge rapide"],
    image: "sony-wh-1000xm6",
  },
  // --- Accessoires
  {
    id: "chargeur-magsafe",
    name: "Chargeur MagSafe (1 m)",
    category: "ACCESSORY",
    description: "Une recharge sans fil qui s'aligne toute seule grâce aux aimants.",
    priceCents: 5900,
    stock: 40,
    highlights: ["Alignement magnétique", "Compatible iPhone et AirPods", "Câble USB‑C intégré"],
    image: "magsafe-charger",
  },
  {
    id: "adaptateur-usb-c-35w",
    name: "Adaptateur secteur double USB‑C 35 W",
    category: "ACCESSORY",
    description: "Rechargez deux appareils à la fois avec un seul adaptateur compact.",
    priceCents: 7900,
    stock: 22,
    highlights: ["Deux ports USB‑C", "35 W au total", "Format compact"],
    image: "usb-c-adapter-35w",
  },
  {
    id: "coque-silicone-magsafe-vert",
    name: "Coque en silicone MagSafe pour iPhone 17 Pro – Sauge",
    category: "ACCESSORY",
    description: "Une coque douce au toucher qui protège votre iPhone sans gêner la recharge MagSafe.",
    priceCents: 6900,
    stock: 15,
    highlights: ["Compatible MagSafe", "Intérieur en microfibre", "Boutons intégrés"],
    image: "silicone-case-green",
  },
  {
    id: "cable-usb-c-tisse",
    name: "Câble de charge USB‑C tissé (1 m)",
    category: "ACCESSORY",
    description: "Un câble tissé résistant pour charger et synchroniser vos appareils USB‑C.",
    priceCents: 2900,
    stock: 60,
    highlights: ["Gaine tissée résistante", "Charge et synchronisation", "USB‑C aux deux extrémités"],
    image: "usb-c-cable",
  },
  {
    id: "airtag-lot-4",
    name: "AirTag (lot de 4)",
    category: "ACCESSORY",
    description: "Retrouvez vos clés, votre sac ou vos bagages depuis votre iPhone.",
    priceCents: 12900,
    compareAtPriceCents: 13900,
    stock: 10,
    highlights: ["Localisation précise", "Pile remplaçable", "Résistant à l'eau et à la poussière"],
    image: "airtag-4-pack",
  },
];

// Produits de l'ancien catalogue d'exemple : désactivés (et non supprimés, pour garder l'historique des commandes).
const RETIRED_IDS = ["seed-notebook", "seed-mug", "seed-bottle", "seed-tote"];

async function main() {
  let created = 0;
  for (const { image, ...product } of products) {
    const existing = await prisma.product.findUnique({ where: { id: product.id }, select: { id: true } });
    if (existing) continue;
    await prisma.product.create({ data: { ...product, currency: "cad", imageUrl: `/products/${image}.svg` } });
    created++;
  }
  const { count: retired } = await prisma.product.updateMany({
    where: { id: { in: RETIRED_IDS }, active: true },
    data: { active: false },
  });
  console.log(`Catalogue Fryle : ${created} produit(s) créé(s), ${products.length - created} déjà présent(s), ${retired} ancien(s) désactivé(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
