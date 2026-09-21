"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

/** Lien de connexion, ou liens « My orders » / « Sign out » quand l'utilisateur est connecté. */
export const AuthMenu = () => {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return null;

  if (!session) {
    return (
      <Link href="/login" className="hover:text-blue-600">
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center space-x-4">
      <Link href="/orders" className="hover:text-blue-600">
        My orders
      </Link>
      <button
        type="button"
        className="hover:text-blue-600"
        onClick={async () => {
          await authClient.signOut();
          router.push("/");
          router.refresh();
        }}
      >
        Sign out
      </button>
    </div>
  );
};
