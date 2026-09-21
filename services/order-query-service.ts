import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";

/** Commande telle qu'affichée à son propriétaire (données sérialisables). */
export type UserOrderView = {
  id: string;
  createdAt: string;
  status: "PENDING_PAYMENT" | "PAID" | "PAYMENT_FAILED" | "EXPIRED" | "CANCELED" | "REFUNDED";
  total: string;
  subtotal: string;
  shipping: string | null;
  tax: string | null;
  items: { name: string; quantity: number; total: string }[];
};

/**
 * Commandes d'un utilisateur. Le filtre sur userId est l'autorisation : un utilisateur ne voit que
 * ses propres commandes. userId doit provenir de la session serveur, jamais d'un paramètre de requête.
 */
export async function listOrdersForUser(userId: string): Promise<UserOrderView[]> {
  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { items: true },
  });

  return orders.map((order) => ({
    id: order.id,
    createdAt: order.createdAt.toISOString(),
    status: order.status,
    total: formatMoney(order.totalCents, order.currency),
    subtotal: formatMoney(order.subtotalCents, order.currency),
    shipping: order.shippingCents > 0 ? formatMoney(order.shippingCents, order.currency) : null,
    tax: order.taxCents > 0 ? formatMoney(order.taxCents, order.currency) : null,
    items: order.items.map((item) => ({
      name: item.productName,
      quantity: item.quantity,
      total: formatMoney(item.totalCents, order.currency),
    })),
  }));
}
