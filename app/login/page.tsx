import Link from "next/link";
import { redirect } from "next/navigation";
import { enabledProviders } from "@/lib/auth-config";
import { getCurrentUser } from "@/lib/auth-session";
import { SignInButtons } from "./sign-in-buttons";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/orders");
  const providers = enabledProviders();

  return (
    <div className="container mx-auto px-4 py-8 text-center">
      <h1 className="mb-2 text-3xl font-bold">Sign in</h1>
      <p className="mb-8 text-neutral-600">Sign in to see your orders. You can also check out as a guest.</p>
      {providers.length > 0 ? (
        <SignInButtons providers={providers} callbackURL="/orders" />
      ) : (
        <p className="text-neutral-600">Sign-in is not available right now.</p>
      )}
      <Link href="/products" className="mt-8 inline-block text-blue-600 hover:underline">
        Continue shopping
      </Link>
    </div>
  );
}
