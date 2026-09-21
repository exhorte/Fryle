import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { TEST_DATABASE_URL } from "./tests/test-db-url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    // Les tests partagent une seule base de test : exécution séquentielle.
    fileParallelism: false,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      STRIPE_SECRET_KEY: "sk_test_dummy",
      STRIPE_WEBHOOK_SECRET: "whsec_test_secret",
      NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
      CRON_SECRET: "cron-test-secret",
      BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-characters-long",
      GITHUB_CLIENT_ID: "test-github-client-id",
      GITHUB_CLIENT_SECRET: "test-github-client-secret",
    },
  },
});
