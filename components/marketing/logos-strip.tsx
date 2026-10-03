import { Link2, Monitor, Radio, Users } from "lucide-react";
import { RevealItem, RevealStagger } from "./ui/reveal";

const STATS = [
  {
    icon: Users,
    title: "Multi-rol",
    detail:
      "Admin, vendedor y técnico: cada uno entra con su propio usuario y ve solo lo que le toca hacer.",
  },
  {
    icon: Radio,
    title: "Actualización en tiempo real",
    detail:
      "Una venta, un ticket o un turno cargado por un compañero aparece al instante en tu pantalla, sin recargar.",
  },
  {
    icon: Link2,
    title: "Todo conectado",
    detail:
      "Una venta descuenta stock, genera el movimiento de caja y queda en la ficha del cliente, sola.",
  },
  {
    icon: Monitor,
    title: "Sin instalación",
    detail:
      "Funciona en el navegador, desde cualquier compu del local. No hay nada que instalar ni mantener.",
  },
];

/**
 * Franja de confianza. Todavía no hay clientes reales para mostrar, así que
 * en vez de logos inventados van datos factuales del producto -- solo los
 * que le importan a quien todavía no usa un CRM (multi-organización y RLS
 * son detalles de implementación, no un argumento de venta).
 */
export function MarketingLogosStrip() {
  return (
    <section className="border-y border-neutral-200/80 bg-white/60">
      <RevealStagger className="mx-auto grid max-w-[100rem] grid-cols-1 divide-y divide-neutral-200/80 px-4 sm:px-6 lg:grid-cols-4 lg:divide-x lg:divide-y-0 xl:px-12">
        {STATS.map((stat) => (
          <RevealItem
            key={stat.title}
            className="flex flex-col items-center px-5 py-6 text-center"
          >
            <p className="inline-flex items-center justify-center text-xs font-semibold text-neutral-900">
              <stat.icon
                className="mr-1.5 h-3.5 w-3.5 shrink-0 text-accent"
                strokeWidth={2}
              />
              {stat.title}
            </p>
            <p className="mt-1.5 line-clamp-3 max-w-[200px] text-[11px] leading-relaxed text-neutral-500">
              {stat.detail}
            </p>
          </RevealItem>
        ))}
      </RevealStagger>
    </section>
  );
}
