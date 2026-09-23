"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, Smartphone } from "lucide-react";
import { navForRole, navCategoriesForRole } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useOutsideClick } from "@/components/ui/use-outside-click";
import { NotificationsBell } from "@/components/notifications/bell";
import { DolarNavbar } from "@/components/dolar-navbar";
import { UserMenu } from "@/components/auth/user-menu";
import { MobileNavDrawer } from "@/components/mobile-nav-drawer";
import type { SessionUser } from "@/lib/auth/types";

export function TopNav({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const items = navForRole(user.rol).filter((n) => n.href !== "/configuracion");
  const categories = navCategoriesForRole(user.rol);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const navRef = useOutsideClick<HTMLElement>(() => setOpenCategory(null));

  useEffect(() => setOpenCategory(null), [pathname]);

  return (
    <>
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
          <span className="hidden font-grotesk text-sm font-semibold tracking-wide md:block">TEKLY</span>
        </Link>

        <nav
          ref={navRef}
          className="hidden min-w-0 flex-1 items-center justify-center gap-1 md:flex"
        >
          {categories.map(({ key, label, icon: Icon, children }) => {
            if (children.length === 1) {
              const { href } = children[0];
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={key}
                  href={href}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "border-accent bg-white text-accent"
                      : "border-transparent text-neutral-600 hover:bg-neutral-100",
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="hidden xl:inline">{label}</span>
                </Link>
              );
            }

            const active = children.some(
              (c) => pathname === c.href || pathname.startsWith(c.href + "/"),
            );
            const open = openCategory === key;
            return (
              <div key={key} className="relative shrink-0">
                <button
                  onClick={() => setOpenCategory(open ? null : key)}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                    active || open
                      ? "border-accent bg-white text-accent"
                      : "border-transparent text-neutral-600 hover:bg-neutral-100",
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="hidden items-center gap-1 xl:flex">
                    {label}
                    <ChevronDown
                      className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
                    />
                  </span>
                </button>

                {open && (
                  <div className="animate-fade-in absolute left-1/2 top-full z-50 mt-2 w-52 -translate-x-1/2 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-xl">
                    {children.map((c) => {
                      const childActive =
                        pathname === c.href || pathname.startsWith(c.href + "/");
                      return (
                        <Link
                          key={c.href}
                          href={c.href}
                          onClick={() => setOpenCategory(null)}
                          className={cn(
                            "flex items-center gap-2.5 px-4 py-2 text-sm",
                            childActive
                              ? "bg-accent-soft text-accent"
                              : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900",
                          )}
                        >
                          <c.icon className="h-4 w-4 shrink-0" />
                          {c.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2.5">
          <DolarNavbar />
          <NotificationsBell esAdmin={user.rol === "admin"} />
          <UserMenu user={user} />
        </div>
      </header>

      {/* Afuera del <header>: el backdrop-blur del header lo vuelve
          containing block de sus descendientes `fixed`, así que este
          overlay quedaba encajonado en los 64px del header en vez de
          cubrir la pantalla entera. */}
      <MobileNavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} items={items} />
    </>
  );
}
