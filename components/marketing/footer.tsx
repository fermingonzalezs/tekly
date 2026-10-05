import { loginUrl } from "@/lib/marketing/app-url";
import { LEGAL_BORRADOR } from "@/lib/legal";
import { TeklyLogo } from "@/components/brand/tekly-logo";
import { SECTION_WRAP } from "./ui/section-heading";

/**
 * Footer mínimo de la landing: marca + tagline, links a secciones y a la
 * app, copyright y links legales (plan 012). Sin redes sociales.
 */

const LINK =
  "rounded-md text-neutral-600 transition-colors duration-150 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40";

export function MarketingFooter() {
  return (
    <footer className={`${SECTION_WRAP} pb-12`}>
      <div className="flex flex-wrap items-center justify-between gap-5 border-t border-neutral-900/[.08] pt-7">
        <a
          href="/"
          className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <TeklyLogo variante="horizontal" altura={28} />
          <span className="hidden text-sm text-neutral-600 sm:inline">
            Gestión para tu local, en tiempo real
          </span>
        </a>
        <nav className="flex gap-6 text-sm">
          <a href="/#modulos" className={LINK}>
            Módulos
          </a>
          <a href="/#precios" className={LINK}>
            Precios
          </a>
          <a href="/ayuda" className={LINK}>
            Ayuda
          </a>
          <a href={loginUrl()} className={LINK}>
            Ingresar
          </a>
        </nav>
        <span className="text-[13px] text-neutral-500">
          © {new Date().getFullYear()} Tekly
        </span>
        {!LEGAL_BORRADOR && (
        <nav aria-label="Legales" className="flex w-full flex-wrap justify-center gap-x-5 gap-y-1.5 text-[13px] sm:justify-start">
          <a href="/terminos" className={LINK}>
            Términos
          </a>
          <a href="/privacidad" className={LINK}>
            Privacidad
          </a>
          <a href="/cookies" className={LINK}>
            Cookies
          </a>
        </nav>
        )}
      </div>
    </footer>
  );
}
