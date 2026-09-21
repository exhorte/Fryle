import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth-session";
import { listOrdersForUser, type UserOrderView } from "@/services/order-query-service";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<UserOrderView["status"], string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PAID: "Paid",
  PAYMENT_FAILED: "Payment failed",
  EXPIRED: "Expired",
  CANCELED: "Canceled",
  REFUNDED: "Refunded",
};

export default async function OrdersPage() {
  // L'identité vient de la session serveur ; la requête est filtrée sur cet utilisateur.
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Les commandes abandonnées (expirées / annulées) n'apportent rien au client.
  const orders = (await listOrdersForUser(user.id)).filter(
    (order) => order.status !== "EXPIRED" && order.status !== "CANCELED",
  );

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-8 text-center text-3xl font-bold">My orders</h1>
      {orders.length === 0 ? (
        <p className="text-center text-neutral-600">
          You have no orders yet.{" "}
          <Link href="/products" className="text-blue-600 hover:underline">
            Browse products
          </Link>
        </p>
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => (
            <li key={order.id}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>{new Date(order.createdAt).toLocaleDateString("en-CA", { dateStyle: "medium" })}</span>
                    <span className="text-sm font-medium text-neutral-600">{STATUS_LABELS[order.status]}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="mb-3 space-y-1 text-sm">
                    {order.items.map((item, index) => (
                      <li key={index} className="flex justify-between">
                        <span>
                          {item.quantity} × {item.name}
                        </span>
                        <span>{item.total}</span>
                      </li>
                    ))}
                  </ul>
                  <dl className="space-y-1 border-t pt-2 text-sm">
                    {order.shipping && (
                      <div className="flex justify-between">
                        <dt>Shipping</dt>
                        <dd>{order.shipping}</dd>
                      </div>
                    )}
                    {order.tax && (
                      <div className="flex justify-between">
                        <dt>Tax</dt>
                        <dd>{order.tax}</dd>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold">
                      <dt>Total</dt>
                      <dd>{order.total}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
