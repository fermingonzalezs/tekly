"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Smartphone, Settings } from "lucide-react";
import { NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { NotificationsBell } from "@/components/notifications/bell";
import { DolarNavbar } from "@/components/dolar-navbar";

export function TopNav() {
  const pathname = usePathname();
  const items = NAV.filter((n) => n.href !== "/configuracion");

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-neutral-200 bg-white/90 px-5 backdrop-blur">
      <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-white">
          <Smartphone className="h-5 w-5" />
        </div>
        <span className="hidden text-sm font-semibold md:block">Tekly</span>
      </Link>

      <nav className="flex min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto">
        {items.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || pathname.startsWith(href + "/");
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
              <span className="hidden lg:inline">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex shrink-0 items-center gap-2.5">
        <DolarNavbar />
        <Link
          href="/configuracion"
          aria-label="Configuración"
          className="grid h-9 w-9 place-items-center rounded-full border border-neutral-200 bg-white text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-700"
        >
          <Settings className="h-4 w-4" />
        </Link>
        <NotificationsBell />
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-[13px] font-semibold text-white">
          FG
        </div>
      </div>
    </header>
  );
}
