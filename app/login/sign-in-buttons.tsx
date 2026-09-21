"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { OAuthProvider } from "@/lib/auth-config";
import { authClient } from "@/lib/auth-client";

const LABELS: Record<OAuthProvider, string> = { google: "Continue with Google", github: "Continue with GitHub" };

export function SignInButtons({ providers, callbackURL }: { providers: OAuthProvider[]; callbackURL: string }) {
  const [pending, setPending] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signIn = async (provider: OAuthProvider) => {
    setPending(provider);
    setError(null);
    const result = await authClient.signIn.social({ provider, callbackURL });
    // En cas de succès le navigateur est redirigé vers le fournisseur ; on n'arrive ici qu'en cas d'échec.
    if (result?.error) {
      setError("Sign-in failed. Please try again.");
      setPending(null);
    }
  };

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-3">
      {providers.map((provider) => (
        <Button key={provider} variant="outline" disabled={pending !== null} onClick={() => signIn(provider)}>
          {pending === provider ? "Redirecting…" : LABELS[provider]}
        </Button>
      ))}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
