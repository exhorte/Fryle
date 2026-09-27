"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Package, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";

/** Accès au compte : lien de connexion, ou menu « Mes commandes / Se déconnecter ». */
export function AccountMenu() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  if (isPending || !session) {
    return (
      <Button asChild variant="ghost" size="icon" className="rounded-full" aria-label="Se connecter">
        <Link href="/login">
          <User className="size-5" />
        </Link>
      </Button>
    );
  }

  const initial = (session.user.name || session.user.email).charAt(0).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Mon compte">
          <span className="flex size-8 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
            {initial}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{session.user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{session.user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/orders">
            <Package /> Mes commandes
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async () => {
            await authClient.signOut();
            router.push("/");
            router.refresh();
          }}
        >
          <LogOut /> Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
