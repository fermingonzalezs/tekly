import { Cloud, Link2, Users, Zap } from "lucide-react";
import { RevealItem, RevealStagger } from "./ui/reveal";
import { GLASS } from "./ui/glass";
import { SECTION_WRAP } from "./ui/section-heading";

/**
 * Pilares: banda de vidrio con los 4 diferenciales del producto, justo
 * debajo del hero. Cada pilar separado por una línea vertical fina (en
 * mobile se apilan y la línea pasa a ser horizontal).
 */

const PILARES = [
  {
    icon: Users,
    title: "Multi-rol",
    detail: "Admin, vendedor y técnico: cada uno ve solo lo que necesita.",
  },
  {
    icon: Zap,
    title: "Tiempo real",
    detail: "Una venta en el mostrador se refleja en el stock y la caja al instante.",
  },
  {
    icon: Link2,
    title: "Todo conectado",
    detail: "Un canje entra al inventario y una reparación cobrada, a la caja.",
  },
  {
    icon: Cloud,
    title: "Sin instalación",
    detail: "Funciona en el navegador, desde la PC del local o el celular.",
  },
];

// Divisores por posición: 1 columna (mobile) → línea arriba; 2 columnas
// (sm) → grilla 2×2; 4 columnas (lg) → solo líneas verticales.
const BORDES = [
  "",
  "border-t sm:border-l sm:border-t-0",
  "border-t lg:border-l lg:border-t-0",
  "border-t sm:border-l lg:border-t-0",
];

export function MarketingLogosStrip() {
  return (
    <section className={`${SECTION_WRAP} pb-16 sm:pb-28`}>
      <RevealStagger
        className={`grid overflow-hidden rounded-3xl sm:grid-cols-2 lg:grid-cols-4 ${GLASS}`}
      >
        {PILARES.map(({ icon: Icon, title, detail }, i) => (
          <RevealItem
            key={title}
            className={`flex h-full flex-col gap-2.5 border-neutral-900/[.06] p-7 ${BORDES[i]}`}
          >
            <Icon className="h-[22px] w-[22px] text-accent" strokeWidth={2} />
            <span className="text-base font-semibold">{title}</span>
            <span className="text-sm leading-normal text-neutral-600">{detail}</span>
          </RevealItem>
        ))}
      </RevealStagger>
    </section>
  );
}
