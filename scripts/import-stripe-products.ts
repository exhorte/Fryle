import "dotenv/config";
import { prisma } from "../lib/db";
import { getStripe } from "../lib/stripe";

// Migration ponctuelle : copie le catalogue Stripe existant dans la base.
//   npm run db:import-stripe            (stock initial : 10 par produit)
//   npm run db:import-stripe -- --stock 25
//
// - L'id Stripe du produit (prod_…) devient l'id en base : les anciens liens /products/prod_… restent valides.
// - Création seulement : un produit déjà présent en base n'est jamais modifié (la base fait foi).
// - Les images restent hébergées sur files.stripe.com. Le prix et le nom viennent de default_price / name.

function parseStock(): number {
  const index = process.argv.indexOf("--stock");
  if (index === -1) return 10;
  const value = Number(process.argv[index + 1]);
  if (!Number.isInteger(value) || value < 0) throw new Error("--stock must be a non-negative integer");
  return value;
}

async function main() {
  const stock = parseStock();
  const stripe = getStripe();

  const rows = [];
  const skipped: string[] = [];
  for await (const product of stripe.products.list({ active: true, expand: ["data.default_price"], limit: 100 })) {
    const price = product.default_price;
    if (!price || typeof price === "string" || price.unit_amount == null || price.unit_amount <= 0) {
      skipped.push(`${product.id} (${product.name}): no usable default price`);
      continue;
    }
    rows.push({
      id: product.id,
      name: product.name,
      description: product.description,
      imageUrl: product.images[0] ?? null,
      priceCents: price.unit_amount,
      currency: price.currency.toLowerCase(),
      stock,
    });
  }

  const { count } = await prisma.product.createMany({ data: rows, skipDuplicates: true });
  console.log(`Imported ${count} new product(s) (${rows.length - count} already present, ${skipped.length} skipped).`);
  for (const line of skipped) console.log(`  skipped: ${line}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
