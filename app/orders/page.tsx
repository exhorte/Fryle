import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Package } from "lucide-react";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth-session";
import { cn } from "@/lib/utils";
import { listOrdersForUser, type UserOrderView } from "@/services/order-query-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mes commandes" };

const STATUS: Record<UserOrderView["status"], { label: string; tone: string }> = {
  PENDING_PAYMENT: { label: "En attente de paiement", tone: "bg-amber-50 text-amber-700" },
  PAID: { label: "Payée", tone: "bg-emerald-50 text-emerald-700" },
  PAYMENT_FAILED: { label: "Paiement refusé", tone: "bg-red-50 text-red-700" },
  EXPIRED: { label: "Expirée", tone: "bg-muted text-muted-foreground" },
  CANCELED: { label: "Annulée", tone: "bg-muted text-muted-foreground" },
  REFUNDED: { label: "Remboursée", tone: "bg-sky-50 text-sky-700" },
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
    <div className="mx-auto max-w-3xl">
      <Breadcrumbs items={[{ label: "Accueil", href: "/" }, { label: "Mes commandes" }]} />
      <h1 className="mb-8 text-4xl font-semibold md:text-5xl">Mes commandes</h1>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center gap-5 rounded-3xl bg-surface px-6 py-20 text-center">
          <Package className="size-10 text-muted-foreground" strokeWidth={1.5} />
          <p className="text-muted-foreground">Vous n&apos;avez pas encore passé de commande.</p>
          <Button asChild className="rounded-full">
            <Link href="/products">Découvrir la boutique</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => {
            const status = STATUS[order.status];
            return (
              <li key={order.id} className="rounded-3xl border p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      Commande du {new Date(order.createdAt).toLocaleDateString("fr-CA", { dateStyle: "long" })}
                    </p>
                    <p className="text-xs text-muted-foreground">N° {order.id}</p>
                  </div>
                  <span className={cn("rounded-full px-3 py-1 text-xs font-medium", status.tone)}>{status.label}</span>
                </div>
                <ul className="space-y-2 border-y py-4 text-sm">
                  {order.items.map((item, index) => (
                    <li key={index} className="flex justify-between gap-4">
                      <span>
                        <span className="text-muted-foreground">{item.quantity} ×</span> {item.name}
                      </span>
                      <span className="tabular-nums">{item.total}</span>
                    </li>
                  ))}
                </ul>
                <dl className="mt-4 space-y-1 text-sm">
                  {order.shipping && (
                    <div className="flex justify-between text-muted-foreground">
                      <dt>Livraison</dt>
                      <dd className="tabular-nums">{order.shipping}</dd>
                    </div>
                  )}
                  {order.tax && (
                    <div className="flex justify-between text-muted-foreground">
                      <dt>Taxes</dt>
                      <dd className="tabular-nums">{order.tax}</dd>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-semibold">
                    <dt>Total</dt>
                    <dd className="tabular-nums">{order.total}</dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
