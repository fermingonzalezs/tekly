"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { loginUrl, signupUrl } from "@/lib/marketing/app-url";
import { MarketingButton } from "./ui/marketing-button";

const LINKS = [
  { label: "Producto", href: "#producto" },
  { label: "Funciones", href: "#features" },
  { label: "Cómo funciona", href: "#como-funciona" },
  { label: "Precios", href: "#precios" },
];

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-colors duration-150 ${
        scrolled
          ? "border-b border-neutral-200/80 bg-white/80 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <nav className="mx-auto grid h-16 max-w-[100rem] grid-cols-[auto_1fr_auto] items-center gap-4 px-4 sm:px-6 xl:px-12">
        <a
          href="#"
          className="flex items-center gap-2 transition-transform duration-150 hover:scale-[1.03]"
          aria-label="Tekly"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent font-grotesk text-sm font-bold text-white">
            T
          </span>
          <span className="font-grotesk text-lg font-semibold text-neutral-900">
            Tekly
          </span>
        </a>

        <div className="hidden items-center justify-center gap-1 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-600 transition-colors duration-150 hover:bg-neutral-100 hover:text-neutral-900"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3">
          <div className="hidden items-center gap-3 md:flex">
            <MarketingButton href={loginUrl()} variant="outline" size="sm">
              Ingresar
            </MarketingButton>
            <MarketingButton href={signupUrl()} variant="primary" size="sm">
              Probar gratis
            </MarketingButton>
          </div>

          <button
            type="button"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-neutral-700 transition-colors duration-150 hover:bg-neutral-100 md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-neutral-100 bg-white px-4 pb-4 pt-2 md:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-3 flex flex-col gap-2">
              <MarketingButton href={loginUrl()} variant="outline" size="md">
                Ingresar
              </MarketingButton>
              <MarketingButton href={signupUrl()} variant="primary" size="md">
                Probar gratis
              </MarketingButton>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
