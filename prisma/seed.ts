import "dotenv/config";
import { prisma } from "../lib/db";

// Produits d'exemple pour le développement. Idempotent : ids fixes, pas de doublons au relancement.
// Les prix sont en centimes (1999 = 19,99 $).
const products = [
  { id: "seed-notebook", name: "Notebook", description: "A5 dotted notebook, 120 pages.", priceCents: 1299, stock: 25 },
  { id: "seed-mug", name: "Ceramic Mug", description: "350 ml stoneware mug.", priceCents: 1850, stock: 12 },
  { id: "seed-bottle", name: "Steel Bottle", description: "Insulated bottle, keeps drinks cold for 24h.", priceCents: 3499, stock: 8 },
  { id: "seed-tote", name: "Canvas Tote", description: "Heavy cotton tote bag.", priceCents: 2200, stock: 3 },
];

async function main() {
  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      create: { ...product, currency: "cad" },
      update: {},
    });
  }
  console.log(`Seeded ${products.length} products.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
