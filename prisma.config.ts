import "dotenv/config";
import { defineConfig } from "prisma/config";

// Les migrations doivent passer par une connexion directe (pas le pooler) : DIRECT_URL si défini.
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: { url },
});
