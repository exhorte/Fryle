import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { checkRateLimit, clientIp, purgeRateLimits, rateLimitKey } from "@/lib/rate-limit";
import { resetDb } from "./helpers";

beforeEach(async () => {
  await resetDb();
});

describe("rateLimitKey / clientIp", () => {
  it("ne contient jamais l'adresse IP en clair", () => {
    const key = rateLimitKey("checkout", "203.0.113.7");
    expect(key.startsWith("checkout:")).toBe(true);
    expect(key).not.toContain("203.0.113.7");
    expect(rateLimitKey("checkout", "203.0.113.7")).toBe(key); // stable
    expect(rateLimitKey("checkout", "203.0.113.8")).not.toBe(key);
  });

  it("lit la première adresse de x-forwarded-for, sinon x-real-ip, sinon « unknown »", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("checkRateLimit", () => {
  it("autorise jusqu'à la limite puis bloque, avec un délai d'attente", async () => {
    const key = rateLimitKey("test", "a");
    for (let i = 0; i < 3; i++) expect((await checkRateLimit(key, 3, 60)).allowed).toBe(true);

    const blocked = await checkRateLimit(key, 3, 60);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("compte séparément chaque clé", async () => {
    const a = rateLimitKey("test", "a");
    const b = rateLimitKey("test", "b");
    await checkRateLimit(a, 1, 60);
    expect((await checkRateLimit(a, 1, 60)).allowed).toBe(false);
    expect((await checkRateLimit(b, 1, 60)).allowed).toBe(true);
  });

  it("repart de zéro une fois la fenêtre écoulée", async () => {
    const key = rateLimitKey("test", "a");
    await checkRateLimit(key, 1, 60);
    expect((await checkRateLimit(key, 1, 60)).allowed).toBe(false);

    await prisma.rateLimit.update({ where: { key }, data: { windowStart: new Date(Date.now() - 61_000) } });

    expect((await checkRateLimit(key, 1, 60)).allowed).toBe(true);
    expect((await checkRateLimit(key, 1, 60)).allowed).toBe(false);
  });

  it("est atomique : 25 appels simultanés avec une limite de 5 en autorisent exactement 5", async () => {
    const key = rateLimitKey("test", "burst");
    const results = await Promise.all(Array.from({ length: 25 }, () => checkRateLimit(key, 5, 60)));
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
  });

  it("purge uniquement les compteurs périmés", async () => {
    const old = rateLimitKey("test", "old");
    const fresh = rateLimitKey("test", "fresh");
    await checkRateLimit(old, 5, 60);
    await checkRateLimit(fresh, 5, 60);
    await prisma.rateLimit.update({ where: { key: old }, data: { windowStart: new Date(Date.now() - 2 * 24 * 3600 * 1000) } });

    expect(await purgeRateLimits()).toBe(1);
    expect(await prisma.rateLimit.count()).toBe(1);
  });
});

describe("checkoutAction : limitation de débit et identité serveur", () => {
  it("bloque après le nombre de tentatives autorisé, par adresse IP", async () => {
    vi.resetModules();
    vi.doMock("next/headers", () => ({
      headers: async () => new Headers({ "x-forwarded-for": "203.0.113.50" }),
    }));
    vi.doMock("@/lib/auth-session", () => ({ getCurrentUser: async () => null }));
    const { checkoutAction } = await import("@/app/checkout/checkout-action");

    const form = new FormData();
    form.set("payload", "not json"); // panier invalide : suffit à consommer une tentative sans toucher Stripe

    for (let i = 0; i < 15; i++) {
      const state = await checkoutAction({}, form);
      expect(state.error).toMatch(/panier est invalide/i);
    }
    const blocked = await checkoutAction({}, form);
    expect(blocked.error).toMatch(/trop de tentatives/i);

    // Une autre adresse n'est pas affectée.
    vi.doMock("next/headers", () => ({
      headers: async () => new Headers({ "x-forwarded-for": "198.51.100.9" }),
    }));
    vi.resetModules();
    const { checkoutAction: otherIp } = await import("@/app/checkout/checkout-action");
    expect((await otherIp({}, form)).error).toMatch(/panier est invalide/i);
    vi.doUnmock("next/headers");
    vi.doUnmock("@/lib/auth-session");
  });
});
