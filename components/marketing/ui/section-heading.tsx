import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

/**
 * Encabezado de sección de la landing: eyebrow en mayúscula (texto plano
 * accent, sin pill) + título display gigante. Dos layouts: `split` (título a
 * la izquierda, bajada a la derecha alineada abajo) y `center`.
 */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  layout = "split",
}: {
  eyebrow: string;
  title: ReactNode;
  lead: ReactNode;
  layout?: "split" | "center";
}) {
  const centrado = layout === "center";
  return (
    <Reveal
      className={cn(
        "flex gap-6",
        centrado
          ? "flex-col items-center text-center"
          : "flex-wrap items-end justify-between",
      )}
    >
      <div className={cn("flex flex-col gap-4", centrado ? "max-w-4xl items-center" : "max-w-3xl")}>
        <span className="text-[13px] font-semibold uppercase tracking-[.1em] text-[var(--chart-1)]">
          {eyebrow}
        </span>
        <h2 className="font-display text-[clamp(2.5rem,5vw,4.25rem)] font-extrabold uppercase leading-[.95] tracking-[-0.03em] text-neutral-900">
          {title}
        </h2>
      </div>
      <p
        className={cn(
          "text-[17px] leading-relaxed text-neutral-600",
          centrado ? "max-w-xl" : "max-w-sm",
        )}
      >
        {lead}
      </p>
    </Reveal>
  );
}

/** Ancho máximo de la landing: 1360px hasta monitores ~1080p, y 1720px desde
 * 2000px de viewport (1440p y más) para no dejar media pantalla vacía. Nav,
 * hero y todas las secciones lo comparten. */
export const LANDING_MAX_W = "max-w-[1360px] min-[2000px]:max-w-[1720px]";

/** Contenedor horizontal común a todas las secciones. */
export const SECTION_WRAP = `mx-auto w-full ${LANDING_MAX_W} px-4 sm:px-6`;
