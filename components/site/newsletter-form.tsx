"use client";

import { useActionState } from "react";
import { ArrowRight, CircleCheck } from "lucide-react";
import { newsletterAction, type NewsletterState } from "@/app/newsletter-action";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function NewsletterForm({ className }: { className?: string }) {
  const [state, formAction, pending] = useActionState<NewsletterState, FormData>(newsletterAction, { status: "idle" });

  if (state.status === "success") {
    return (
      <p role="status" className={cn("flex items-center justify-center gap-2 font-medium", className)}>
        <CircleCheck className="size-5 text-emerald-600" /> {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className={cn("w-full", className)}>
      <div className="flex gap-2 rounded-full bg-background p-1.5 shadow-sm ring-1 ring-border focus-within:ring-2 focus-within:ring-ring/40">
        <label htmlFor="newsletter-email" className="sr-only">
          Adresse e-mail
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="Votre adresse e-mail"
          aria-invalid={state.status === "error" || undefined}
          aria-describedby={state.status === "error" ? "newsletter-error" : undefined}
          className="min-w-0 flex-1 bg-transparent px-4 text-sm outline-none placeholder:text-muted-foreground"
        />
        <Button type="submit" disabled={pending} className="h-10 rounded-full px-5">
          {pending ? "Envoi…" : "S'inscrire"}
          {!pending && <ArrowRight />}
        </Button>
      </div>
      {state.status === "error" && (
        <p id="newsletter-error" role="alert" className="mt-2 text-center text-sm text-destructive">
          {state.message}
        </p>
      )}
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Un e-mail de temps en temps, jamais de spam. Désinscription sur simple demande.
      </p>
    </form>
  );
}
