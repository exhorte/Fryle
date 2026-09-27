import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, CircleX, LoaderCircle, RotateCcw, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { enabledProviders } from "@/lib/auth-config";
import { cn } from "@/lib/utils";
import { getOrderStatusBySessionId } from "@/services/order-service";
import { syncCheckoutSessionFromStripe } from "@/services/payment-confirmation-service";
import { AutoRefresh } from "./auto-refresh";
import { ClearCart } from "./clear-cart";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Confirmation de commande" };

// Ne jamais considérer l'arrivée sur cette URL comme une preuve de paiement :
// l'état affiché vient de la base, mise à jour par le webhook Stripe signé ou par la vérification ci-dessous.
export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams;
  const valid = typeof session_id === "string" && /^cs_[A-Za-z0-9_]{1,200}$/.test(session_id);
  // Commande encore en attente : on vérifie directement auprès de Stripe (webhook en retard ou perdu).
  if (valid) await syncCheckoutSessionFromStripe(session_id);
  const status = valid ? await getOrderStatusBySessionId(session_id) : { state: "not_found" as const };

  const view = {
    paid: {
      icon: CircleCheck,
      tone: "bg-emerald-50 text-emerald-600",
      title: "Merci pour votre commande !",
      text:
        status.state === "paid"
          ? `Nous avons bien reçu votre paiement de ${status.total}. Votre commande est en cours de préparation.`
          : "",
    },
    processing: {
      icon: LoaderCircle,
      tone: "bg-muted text-foreground [&_svg]:animate-spin",
      title: "Confirmation du paiement…",
      text: "Cela prend généralement quelques secondes. Cette page se met à jour automatiquement.",
    },
    refunded: {
      icon: RotateCcw,
      tone: "bg-amber-50 text-amber-600",
      title: "Paiement remboursé",
      text: "Votre paiement a été intégralement remboursé, par exemple parce qu'un article est devenu indisponible pendant le paiement. Le remboursement peut prendre quelques jours à apparaître sur votre relevé.",
    },
    unpaid: {
      icon: CircleX,
      tone: "bg-red-50 text-red-600",
      title: "Paiement non finalisé",
      text: "Votre paiement n'a pas abouti et vous n'avez pas été débité.",
    },
    not_found: {
      icon: SearchX,
      tone: "bg-muted text-muted-foreground",
      title: "Commande introuvable",
      text: "Nous ne trouvons pas de commande correspondant à ce lien.",
    },
  }[status.state];
  const Icon = view.icon;

  return (
    <div className="mx-auto max-w-xl py-10 text-center">
      {status.state === "paid" && <ClearCart cartId={status.cartId} />}
      {status.state === "processing" && <AutoRefresh />}
      <span className={cn("mx-auto mb-6 flex size-20 items-center justify-center rounded-full", view.tone)}>
        <Icon className="size-10" strokeWidth={1.75} />
      </span>
      <h1 className="mb-3 text-4xl font-semibold">{view.title}</h1>
      <p className="mb-8 text-lg text-muted-foreground">{view.text}</p>
      <div className="flex flex-wrap justify-center gap-3">
        {status.state === "unpaid" && (
          <Button asChild size="lg" className="rounded-full">
            <Link href="/checkout">Retourner au panier</Link>
          </Button>
        )}
        {status.state === "paid" && enabledProviders().length > 0 && (
          <Button asChild size="lg" variant="outline" className="rounded-full">
            <Link href="/orders">Mes commandes</Link>
          </Button>
        )}
        <Button asChild size="lg" className="rounded-full" variant={status.state === "unpaid" ? "outline" : "default"}>
          <Link href="/products">Continuer mes achats</Link>
        </Button>
      </div>
    </div>
  );
}
