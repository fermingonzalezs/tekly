"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Smartphone } from "lucide-react";
import { navForRole } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { NotificationsBell } from "@/components/notifications/bell";
import { DolarNavbar } from "@/components/dolar-navbar";
import { UserMenu } from "@/components/auth/user-menu";
import { MobileNavDrawer } from "@/components/mobile-nav-drawer";
import type { SessionUser } from "@/lib/auth/types";

export function TopNav({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const items = navForRole(user.rol).filter((n) => n.href !== "/configuracion");
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-neutral-200 bg-white/90 px-5 backdrop-blur">
      <button
        onClick={() => setDrawerOpen(true)}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100 md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-white">
          <Smartphone className="h-5 w-5" />
        </div>
        <span className="hidden text-sm font-semibold md:block">Tekly</span>
      </Link>

      <MobileNavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} items={items} />

      <nav className="no-scrollbar hidden min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto md:flex">
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
        <NotificationsBell esAdmin={user.rol === "admin"} />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
