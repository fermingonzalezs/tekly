"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ShoppingCart } from "lucide-react";
import { TeklyLogo } from "@/components/brand/tekly-logo";
import { ButtonLink } from "@/components/ui/button";
import { signupUrl } from "@/lib/marketing/app-url";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/demo/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/demo/ventas", label: "Ventas", icon: ShoppingCart },
] as const;

/** Nav reducida de la demo (plan 014): logo + 2 secciones + CTA a registro.
 * No usa `TopNav`/`navForRole` para no arrastrar sesión ni drawer. */
export function DemoNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-neutral-200 bg-white/90 px-4 backdrop-blur sm:gap-4 sm:px-5">
      <Link href="/demo/dashboard" className="flex shrink-0 items-center gap-2">
        <TeklyLogo variante="horizontal" altura={30} alt="Tekly" />
      </Link>

      <nav className="flex min-w-0 flex-1 items-center gap-1">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-accent bg-white text-accent"
                  : "border-transparent text-neutral-600 hover:bg-neutral-100",
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          );
        })}
      </nav>

      <ButtonLink
        href={signupUrl()}
        variant="primary"
        size="sm"
        className="shrink-0"
      >
        Crear cuenta
      </ButtonLink>
    </header>
  );
}
