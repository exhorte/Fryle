"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 10;

/** Le webhook peut arriver quelques secondes après le retour de Stripe : on relit l'état côté serveur. */
export function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts += 1;
      router.refresh();
      if (attempts >= MAX_ATTEMPTS) clearInterval(interval);
    }, INTERVAL_MS);
    return () => clearInterval(interval);
  }, [router]);

  return null;
}
