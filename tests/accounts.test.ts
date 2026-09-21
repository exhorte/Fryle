import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as authGet } from "@/app/api/auth/[...all]/route";
import { getAuth } from "@/lib/auth";
import { enabledProviders } from "@/lib/auth-config";
import { prisma } from "@/lib/db";
import { createCheckoutSession } from "@/services/checkout-service";
import { listOrdersForUser } from "@/services/order-query-service";
import { createProduct, resetDb, startCheckout } from "./helpers";
import { resetStripeMock, stripeMock } from "./stripe-mock";

vi.mock("@/lib/stripe", async () => (await import("./stripe-mock")).stripeModule);

beforeEach(async () => {
  await resetDb();
  resetStripeMock();
});

const createUser = (name: string) =>
  prisma.user.create({ data: { id: `user_${name}`, name, email: `${name}@example.com`, emailVerified: true } });

describe("Better Auth (connexion OAuth)", () => {
  it("n'active que les fournisseurs dont l'ID et le secret sont définis", () => {
    expect(enabledProviders()).toEqual(["github"]); // Google n'est pas configuré dans l'environnement de test
  });

  it("le schéma Prisma est compatible : création d'un utilisateur, d'une session et lecture par jeton", async () => {
    const ctx = await getAuth().$context;
    const user = await ctx.internalAdapter.createUser({ email: "a@example.com", name: "A", emailVerified: true }, { method: "oauth" });
    const session = await ctx.internalAdapter.createSession(user.id, false);

    const found = await ctx.internalAdapter.findSession(session.token);
    expect(found?.user.id).toBe(user.id);
    expect(await prisma.user.count()).toBe(1);
  });

  it("démarre une connexion GitHub avec l'URL de rappel attendue", async () => {
    const result = await getAuth().api.signInSocial({ body: { provider: "github", callbackURL: "/orders" } });

    const url = new URL(result.url!);
    expect(url.origin + url.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("test-github-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/auth/callback/github");
  });

  it("la route /api/auth répond sans session (aucun utilisateur connecté)", async () => {
    const response = await authGet(new Request("http://localhost:3000/api/auth/get-session"));
    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
  });
});

describe("commandes rattachées à un compte", () => {
  it("rattache la commande à l'utilisateur et préremplit son e-mail chez Stripe", async () => {
    const user = await createUser("alice");
    const product = await createProduct();

    const { order } = await startCheckout([{ productId: product.id, quantity: 1 }], randomUUID(), {
      userId: user.id,
      email: user.email,
    });

    expect(order.userId).toBe(user.id);
    expect(stripeMock.checkout.sessions.create.mock.calls[0][0].customer_email).toBe("alice@example.com");
  });

  it("le paiement invité reste possible : pas d'utilisateur, pas d'e-mail imposé", async () => {
    const product = await createProduct();
    const { order } = await startCheckout([{ productId: product.id, quantity: 1 }]);

    expect(order.userId).toBeNull();
    expect(stripeMock.checkout.sessions.create.mock.calls[0][0].customer_email).toBeUndefined();
  });

  it("ignore un userId glissé dans le corps de la requête (seule la session serveur compte)", async () => {
    const victim = await createUser("victim");
    const product = await createProduct();

    await createCheckoutSession({
      cartId: randomUUID(),
      userId: victim.id,
      items: [{ productId: product.id, quantity: 1, userId: victim.id }],
    });

    expect((await prisma.order.findFirstOrThrow()).userId).toBeNull();
  });

  it("rattache à l'utilisateur une commande invité en cours quand il se connecte puis revient sur le même panier", async () => {
    const user = await createUser("alice");
    const product = await createProduct();
    const cartId = randomUUID();
    const items = [{ productId: product.id, quantity: 1 }];

    const guest = await startCheckout(items, cartId);
    expect(guest.order.userId).toBeNull();

    const again = await createCheckoutSession({ cartId, items }, { userId: user.id, email: user.email });

    expect(again.url).toBe(guest.url); // même session, pas de nouvelle réservation
    expect((await prisma.order.findUniqueOrThrow({ where: { id: guest.order.id } })).userId).toBe(user.id);
    expect(await prisma.order.count()).toBe(1);
  });

  it("ne réutilise jamais la commande en cours d'un autre utilisateur", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");
    const product = await createProduct({ stock: 5 });
    const cartId = randomUUID();
    const items = [{ productId: product.id, quantity: 1 }];

    const first = await startCheckout(items, cartId, { userId: alice.id, email: alice.email });
    const second = await startCheckout(items, cartId, { userId: bob.id, email: bob.email });

    expect(second.sessionId).not.toBe(first.sessionId);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: first.order.id } })).status).toBe("CANCELED");
    expect(second.order.userId).toBe(bob.id);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(4);
  });

  it("supprimer un compte conserve les commandes (userId à null)", async () => {
    const user = await createUser("alice");
    const product = await createProduct();
    const { order } = await startCheckout([{ productId: product.id, quantity: 1 }], randomUUID(), { userId: user.id });

    await prisma.user.delete({ where: { id: user.id } });

    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).userId).toBeNull();
  });
});

describe("autorisation : un utilisateur ne voit que ses commandes", () => {
  it("listOrdersForUser filtre sur le propriétaire et trie du plus récent au plus ancien", async () => {
    const alice = await createUser("alice");
    const bob = await createUser("bob");
    const product = await createProduct({ stock: 10, name: "Mug", priceCents: 1850 });

    const a1 = await startCheckout([{ productId: product.id, quantity: 1 }], randomUUID(), { userId: alice.id });
    const a2 = await startCheckout([{ productId: product.id, quantity: 2 }], randomUUID(), { userId: alice.id });
    await startCheckout([{ productId: product.id, quantity: 3 }], randomUUID(), { userId: bob.id });
    await startCheckout([{ productId: product.id, quantity: 1 }]); // invité

    const orders = await listOrdersForUser(alice.id);

    expect(orders.map((o) => o.id)).toEqual([a2.order.id, a1.order.id]);
    expect(orders[0]).toMatchObject({ total: "$37.00", status: "PENDING_PAYMENT" });
    expect(orders[0].items).toEqual([{ name: "Mug", quantity: 2, total: "$37.00" }]);
    expect(await listOrdersForUser("someone-else")).toEqual([]);
  });
});
