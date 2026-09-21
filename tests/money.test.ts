import { describe, expect, it } from "vitest";
import { currencyDigits, formatMoney, isSupportedCurrency } from "@/lib/money";

describe("money", () => {
  it("formate des entiers en unité mineure", () => {
    expect(formatMoney(1999, "cad")).toBe("$19.99");
    expect(formatMoney(5, "cad")).toBe("$0.05");
    expect(formatMoney(100000, "cad")).toBe("$1,000.00");
  });

  it("respecte le nombre de décimales de la devise", () => {
    expect(currencyDigits("cad")).toBe(2);
    expect(currencyDigits("jpy")).toBe(0);
    expect(formatMoney(500, "jpy", "en-US")).toBe("¥500");
  });

  it("n'accepte que les devises prises en charge (insensible à la casse)", () => {
    expect(isSupportedCurrency("CAD")).toBe(true);
    expect(isSupportedCurrency("eur")).toBe(true);
    expect(isSupportedCurrency("jpy")).toBe(false);
    expect(isSupportedCurrency("")).toBe(false);
  });
});
