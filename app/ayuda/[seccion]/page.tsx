import Link from "next/link";
import { notFound } from "next/navigation";
import { SECTION_WRAP } from "@/components/marketing/ui/section-heading";
import { SITE_URL } from "@/lib/marketing/seo";
import { SECCIONES_AYUDA, SECCION_LABEL, indicePorSeccion } from "@/lib/ayuda";

/** Índice de una sección del centro de ayuda (`/ayuda/<seccion>`): lo abre el
 * `?` de ayuda contextual de cada pantalla de la app y es el nivel intermedio
 * del breadcrumb de los artículos. */

export function generateStaticParams() {
  return indicePorSeccion().map((g) => ({ seccion: g.seccion }));
}

export function generateMetadata({ params }: { params: { seccion: string } }) {
  const grupo = indicePorSeccion().find((g) => g.seccion === params.seccion);
  if (!grupo) return { title: "Sección no encontrada" };
  const label = SECCION_LABEL[grupo.seccion];
  return {
    title: label,
    description: `Guías y artículos de Tekly sobre ${label.toLowerCase()}: paso a paso, errores comunes y qué ve cada rol.`,
    alternates: { canonical: `${SITE_URL}/ayuda/${grupo.seccion}` },
  };
}

export default function SeccionAyudaPage({ params }: { params: { seccion: string } }) {
  if (!(SECCIONES_AYUDA as readonly string[]).includes(params.seccion)) notFound();
  const grupo = indicePorSeccion().find((g) => g.seccion === params.seccion);
  if (!grupo) notFound();

  return (
    <main className={`${SECTION_WRAP} pb-24 pt-10`}>
      <nav className="flex items-center gap-1.5 text-xs text-neutral-500">
        <Link href="/ayuda" className="transition-colors hover:text-accent">
          Ayuda
        </Link>
        <span>/</span>
        <span>{SECCION_LABEL[grupo.seccion]}</span>
      </nav>
      <h1 className="mt-3 font-display text-[clamp(2rem,4vw,3rem)] font-extrabold uppercase leading-[.98] tracking-[-0.02em]">
        {SECCION_LABEL[grupo.seccion]}
      </h1>
      <div className="mt-8 grid max-w-3xl gap-3">
        {grupo.articulos.map((a) => (
          <Link
            key={a.id}
            href={a.url}
            className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition-colors hover:border-accent/50"
          >
            <p className="text-sm font-semibold text-neutral-900">{a.titulo}</p>
            <p className="mt-1 text-[13px] text-neutral-600">{a.resumen}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
