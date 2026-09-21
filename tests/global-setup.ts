import { execSync } from "node:child_process";
import pg from "pg";
import { TEST_DATABASE_URL } from "./test-db-url";

// Crée la base de test si besoin et y applique les migrations.
// Nécessite PostgreSQL : `npm run db:up` (docker compose up -d).
export default async function setup() {
  const dbName = new URL(TEST_DATABASE_URL).pathname.slice(1);
  if (!dbName.endsWith("_test")) {
    throw new Error(`Refusing to run tests against "${dbName}": the test database name must end with "_test".`);
  }

  const admin = new URL(TEST_DATABASE_URL);
  admin.pathname = "/postgres";
  const client = new pg.Client({ connectionString: admin.toString() });
  try {
    await client.connect();
  } catch (error) {
    throw new Error(
      `Cannot reach PostgreSQL for tests (${admin.host}). Start it with "npm run db:up". ${(error as Error).message}`,
    );
  }
  const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (!exists.rowCount) await client.query(`CREATE DATABASE "${dbName}"`);
  await client.end();

  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL, DIRECT_URL: TEST_DATABASE_URL },
  });
}
