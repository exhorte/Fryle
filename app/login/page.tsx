import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/site/logo";
import { enabledProviders } from "@/lib/auth-config";
import { getCurrentUser } from "@/lib/auth-session";
import { SignInButtons } from "./sign-in-buttons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/orders");
  const providers = enabledProviders();

  return (
    <div className="mx-auto max-w-md py-10">
      <div className="rounded-3xl border p-8 text-center shadow-sm sm:p-10">
        <LogoMark className="mx-auto mb-6 size-12" />
        <h1 className="mb-2 text-3xl font-semibold">Bienvenue chez Fryle</h1>
        <p className="mb-8 text-muted-foreground">
          Connectez-vous pour suivre vos commandes. Vous pouvez aussi commander sans compte.
        </p>
        {providers.length > 0 ? (
          <SignInButtons providers={providers} callbackURL="/orders" />
        ) : (
          <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">La connexion n&apos;est pas disponible pour le moment.</p>
        )}
        <p className="mt-8 text-xs text-muted-foreground">
          Nous ne recevons que votre nom et votre adresse e-mail, jamais votre mot de passe.
        </p>
      </div>
      <Link href="/products" className="mt-6 block text-center text-sm font-medium text-muted-foreground hover:text-foreground">
        Continuer sans compte
      </Link>
    </div>
  );
}
