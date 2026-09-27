import { describe, expect, it } from "vitest";
import { currencyDigits, formatMoney, isSupportedCurrency } from "@/lib/money";

// fr-CA sépare les milliers et le symbole par une espace insécable (U+00A0).
const nbsp = " ";

describe("money", () => {
  it("formate des entiers en unité mineure, en français canadien par défaut", () => {
    expect(formatMoney(1999, "cad")).toBe(`19,99${nbsp}$`);
    expect(formatMoney(5, "cad")).toBe(`0,05${nbsp}$`);
    expect(formatMoney(159900, "cad")).toBe(`1${nbsp}599,00${nbsp}$`);
  });

  it("respecte le nombre de décimales de la devise et la locale demandée", () => {
    expect(currencyDigits("cad")).toBe(2);
    expect(currencyDigits("jpy")).toBe(0);
    expect(formatMoney(500, "jpy", "en-US")).toBe("¥500");
    expect(formatMoney(1999, "cad", "en-CA")).toBe("$19.99");
  });

  it("n'accepte que les devises prises en charge (insensible à la casse)", () => {
    expect(isSupportedCurrency("CAD")).toBe(true);
    expect(isSupportedCurrency("eur")).toBe(true);
    expect(isSupportedCurrency("jpy")).toBe(false);
    expect(isSupportedCurrency("")).toBe(false);
  });
});
