import { Search } from "lucide-react";
import { HelpCircle } from "lucide-react";
import { SECCION_LABEL, type SeccionAyuda } from "@/lib/ayuda-secciones";
import { SITE_URL } from "@/lib/marketing/seo";

/** En producción la ayuda vive en tekly.tech (dominio canónico, con la landing
 * detrás del nav); en sistema.tekly.tech un `/` o `/#modulos` caería en el
 * login. En dev (mismo host) alcanza el path relativo. */
const AYUDA_BASE = process.env.NODE_ENV === "production" ? SITE_URL : "";

export function Topbar({
  toolbar,
  ayuda,
}: {
  toolbar?: React.ReactNode;
  /** Sección de la ayuda contextual: muestra un `?` que abre el artículo en
   * una pestaña nueva (`/ayuda/<seccion>`). */
  ayuda?: SeccionAyuda;
}) {
  return (
    <div className="sticky top-16 z-20 flex h-14 items-center gap-4 border-b border-neutral-200 bg-neutral-50/85 px-4 backdrop-blur sm:px-8">
      {toolbar}
      {ayuda && (
        <a
          href={`${AYUDA_BASE}/ayuda/${ayuda}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Abrir ayuda de ${SECCION_LABEL[ayuda]}`}
          className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1"
        >
          <HelpCircle className="h-4 w-4" />
        </a>
      )}
      <div className={`relative hidden sm:block ${ayuda ? "" : "ml-auto"}`}>
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
        <input
          placeholder="Buscar…"
          className="h-9 w-56 rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-accent"
        />
      </div>
    </div>
  );
}
