import { timingSafeEqual } from "node:crypto";
import { purgeRateLimits } from "@/lib/rate-limit";
import { refundUnfulfillableOrders } from "@/services/auto-refund-service";
import { reconcilePendingOrders } from "@/services/reconcile-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

// Appelé par un cron (ex. Vercel Cron envoie « Authorization: Bearer $CRON_SECRET »).
export async function GET(request: Request) {
  if (!isAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  const reconciled = await reconcilePendingOrders();
  const autoRefunds = await refundUnfulfillableOrders(20);
  const purgedRateLimits = await purgeRateLimits();
  return Response.json({ ...reconciled, autoRefunds, purgedRateLimits });
}
