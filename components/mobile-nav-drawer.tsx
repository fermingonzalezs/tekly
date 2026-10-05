"use client";

import { IconButton } from "@/components/ui/button";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { TeklyLogo } from "@/components/brand/tekly-logo";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/nav";

export function MobileNavDrawer({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
}) {
  const pathname = usePathname();
  const [rendered, setRendered] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setRendered(true);
      setClosing(false);
      return;
    }
    if (!rendered) return;
    setClosing(true);
    const t = setTimeout(() => {
      setRendered(false);
      setClosing(false);
    }, 200);
    return () => clearTimeout(t);
  }, [open, rendered]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!rendered) return null;

  return (
    <div
      className={cn(
        closing ? "animate-fade-out" : "animate-fade-in",
        "fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-[2px] md:hidden",
      )}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          closing ? "animate-drawer-out" : "animate-drawer-in",
          "flex h-full w-[80%] max-w-72 flex-col border-r border-neutral-200 bg-white shadow-2xl",
        )}
      >
        <div className="flex h-16 shrink-0 items-center gap-2 border-b border-neutral-200 px-5">
          <TeklyLogo variante="horizontal" altura={30} />
          <IconButton aria-label="Cerrar menú" icon={X} variant="ghost" onClick={onClose} className="ml-auto" />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent-soft text-accent"
                    : "text-neutral-600 hover:bg-neutral-100",
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
