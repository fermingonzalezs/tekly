import Link from "next/link";
import { BookOpen, Rocket, Users } from "lucide-react";
import { SECTION_WRAP } from "@/components/marketing/ui/section-heading";
import { BuscadorAyuda } from "@/components/ayuda/buscador";
import {
  SECCION_LABEL,
  indicePorSeccion,
  indicePlano,
  type SeccionAyuda,
} from "@/lib/ayuda";

export const metadata = {
  title: "Centro de ayuda",
  description:
    "Manual y guías de Tekly: cómo cargar ventas, reparaciones, cajas, inventario y más, paso a paso.",
  alternates: { canonical: "/ayuda" },
};

/** Secciones que la landing destaca como «módulos» (con guía). */
const DESTACADAS: SeccionAyuda[] = [
  "primeros-pasos",
  "ventas",
  "inventario",
  "reparaciones",
  "cajas",
  "analiticas",
];

const ROLES = [
  { rol: "admin", label: "Guía del admin", href: "/ayuda/roles/guia-admin" },
  { rol: "vendedor", label: "Guía del vendedor", href: "/ayuda/roles/guia-vendedor" },
  { rol: "tecnico", label: "Guía del técnico", href: "/ayuda/roles/guia-tecnico" },
];

export default function AyudaHome() {
  const porSeccion = indicePorSeccion();
  const indice = indicePlano();

  return (
    <main className={`${SECTION_WRAP} pb-24 pt-10`}>
      <div className="flex flex-col items-start gap-6">
        <span className="text-[13px] font-semibold uppercase tracking-[.1em] text-[var(--chart-1)]">
          Centro de ayuda
        </span>
        <h1 className="font-display text-[clamp(2.25rem,5vw,3.75rem)] font-extrabold uppercase leading-[.95] tracking-[-0.03em]">
          ¿En qué te damos una mano?
        </h1>
        <BuscadorAyuda indice={indice} />
      </div>

      {/* Accesos rápidos por rol */}
      <section className="mt-12">
        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <Users className="h-4 w-4 text-accent" /> Guías por rol
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {ROLES.map((r) => (
            <Link
              key={r.rol}
              href={r.href}
              className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm font-semibold text-neutral-800 shadow-sm transition-colors hover:border-accent/50 hover:text-accent"
            >
              {r.label}
            </Link>
          ))}
        </div>
      </section>

      {/* Primeros pasos destacado */}
      <section className="mt-12">
        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <Rocket className="h-4 w-4 text-accent" /> Para empezar
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {porSeccion
            .find((g) => g.seccion === "primeros-pasos")
            ?.articulos.map((a) => (
              <Link
                key={a.id}
                href={a.url}
                className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition-colors hover:border-accent/50"
              >
                <p className="text-sm font-semibold text-neutral-900">{a.titulo}</p>
                <p className="mt-1 text-xs leading-relaxed text-neutral-500">{a.resumen}</p>
              </Link>
            ))}
        </div>
      </section>

      {/* Guías por módulo */}
      <section className="mt-12">
        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <BookOpen className="h-4 w-4 text-accent" /> Guías por módulo
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {porSeccion
            .filter((g) => g.seccion !== "primeros-pasos" && DESTACADAS.includes(g.seccion))
            .map((g) => (
              <Link
                key={g.seccion}
                href={g.articulos[0].url}
                className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition-colors hover:border-accent/50"
              >
                <p className="text-sm font-semibold text-neutral-900">{SECCION_LABEL[g.seccion]}</p>
                <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                  {g.articulos[0].resumen}
                </p>
              </Link>
            ))}
        </div>
      </section>

      {/* Todos los artículos */}
      <section className="mt-12">
        <h2 className="text-sm font-semibold text-neutral-900">Todos los artículos</h2>
        <div className="mt-3 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {porSeccion.map((g) => (
            <div key={g.seccion}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                {g.label}
              </p>
              <ul className="mt-2 space-y-1.5">
                {g.articulos.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={a.url}
                      className="text-sm text-neutral-600 transition-colors hover:text-accent"
                    >
                      {a.titulo}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
