import { loginUrl, signupUrl } from "@/lib/marketing/app-url";
import { MarketingButton } from "./ui/marketing-button";

/**
 * Footer mínimo de la landing: marca, links a las secciones y a la app. Sin
 * redes sociales ni links a páginas que no existen (ver plan).
 */
export function MarketingFooter() {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-[100rem] flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center xl:px-12">
        <div className="flex items-center gap-4">
          <a
            href="/"
            className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1"
            aria-label="Tekly"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent font-grotesk text-xs font-bold text-white">
              T
            </span>
            <span className="font-grotesk text-base font-semibold text-neutral-900">
              Tekly
            </span>
          </a>
          <p className="hidden text-[13px] text-neutral-500 md:block">
            Dejá de anotar tu stock en tres lugares distintos.
          </p>
        </div>

        <nav className="flex items-center gap-6 text-sm md:ml-auto">
          <a
            href="#producto"
            className="rounded-md font-medium text-neutral-600 transition-colors duration-150 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            Producto
          </a>
          <a
            href={loginUrl()}
            className="rounded-md font-medium text-neutral-600 transition-colors duration-150 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            Ingresar
          </a>
          <MarketingButton href={signupUrl()} variant="primary">
            Probar gratis
          </MarketingButton>
        </nav>
      </div>

      <div className="border-t border-neutral-100">
        <p className="mx-auto max-w-[100rem] px-4 py-4 text-xs text-neutral-500 sm:px-6 xl:px-12">
          © {new Date().getFullYear()} Tekly
        </p>
      </div>
    </footer>
  );
}
