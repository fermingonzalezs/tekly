"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { demoUrl, loginUrl, signupUrl } from "@/lib/marketing/app-url";
import { MarketingButton } from "./ui/marketing-button";
import { TeklyLogo } from "@/components/brand/tekly-logo";
import { LANDING_MAX_W } from "./ui/section-heading";

/** Anclas con `/` adelante: este nav también se usa en `/ayuda`, donde un
 * `#modulos` suelto no llevaría a ningún lado. En la landing `/#modulos`
 * scrollea sin recargar. */
const LINKS = [
  { label: "Módulos", href: "/#modulos" },
  { label: "Analíticas", href: "/#analiticas" },
  { label: "Cómo funciona", href: "/#como-funciona" },
  { label: "Precios", href: "/#precios" },
  { label: "Ayuda", href: "/ayuda" },
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
          ? "border-b border-neutral-900/5 bg-[#f7f7fa]/70 backdrop-blur-lg"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <nav className={`mx-auto grid h-16 ${LANDING_MAX_W} grid-cols-[auto_1fr_auto] items-center gap-4 px-4 sm:px-6`}>
        <a
          href="/"
          className="flex items-center gap-2 rounded-lg transition-transform duration-150 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1"
          aria-label="Tekly"
        >
          <TeklyLogo variante="horizontal" altura={34} alt="" />
        </a>

        <div className="hidden items-center justify-center gap-4 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-3 py-2 text-sm font-medium text-neutral-600 transition-colors duration-150 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3">
          <div className="hidden items-center gap-3 md:flex">
            <MarketingButton href={demoUrl()} variant="outline" size="sm">
              Ver demo
            </MarketingButton>
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
            className="flex h-11 w-11 items-center justify-center rounded-lg text-neutral-700 transition-colors duration-150 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 md:hidden"
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
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-3 flex flex-col gap-2">
              <MarketingButton href={demoUrl()} variant="outline" size="md">
                Ver demo
              </MarketingButton>
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
