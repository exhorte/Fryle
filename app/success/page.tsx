import Link from "next/link";
import { getOrderStatusBySessionId } from "@/services/order-service";
import { AutoRefresh } from "./auto-refresh";
import { ClearCart } from "./clear-cart";

export const dynamic = "force-dynamic";

// Ne jamais considérer l'arrivée sur cette URL comme une preuve de paiement :
// l'état affiché vient de la base, mise à jour uniquement par le webhook Stripe signé.
export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams;
  const valid = typeof session_id === "string" && /^cs_[A-Za-z0-9_]{1,200}$/.test(session_id);
  const status = valid ? await getOrderStatusBySessionId(session_id) : { state: "not_found" as const };

  return (
    <div className="container mx-auto px-4 py-8 text-center">
      {status.state === "paid" && (
        <>
          <ClearCart cartId={status.cartId} />
          <h1 className="mb-4 text-3xl font-bold">Payment Successful!</h1>
          <p className="mb-4">Thank you for your purchase. We received your payment of {status.total}.</p>
        </>
      )}
      {status.state === "processing" && (
        <>
          <AutoRefresh />
          <h1 className="mb-4 text-3xl font-bold">Confirming your payment…</h1>
          <p className="mb-4">This usually takes a few seconds. This page will update automatically.</p>
        </>
      )}
      {status.state === "refunded" && (
        <>
          <h1 className="mb-4 text-3xl font-bold">Payment refunded</h1>
          <p className="mb-4">
            Your payment was refunded in full. If an item became unavailable while you were paying, this is the
            reason. The refund can take a few days to appear on your statement.
          </p>
        </>
      )}
      {status.state === "unpaid" && (
        <>
          <h1 className="mb-4 text-3xl font-bold">Payment not completed</h1>
          <p className="mb-4">Your payment was not completed and you have not been charged.</p>
          <Link href="/checkout" className="mb-4 block text-blue-600 hover:underline">
            Return to checkout
          </Link>
        </>
      )}
      {status.state === "not_found" && (
        <>
          <h1 className="mb-4 text-3xl font-bold">Order not found</h1>
          <p className="mb-4">We could not find an order for this link.</p>
        </>
      )}
      <Link href="/products" className="text-blue-600 hover:underline">
        Continue Shopping
      </Link>
    </div>
  );
}
