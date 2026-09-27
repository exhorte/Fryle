// Base dédiée aux tests (jamais la base de développement) : les tests la vident entre chaque cas.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:55432/ecommerce_test";
