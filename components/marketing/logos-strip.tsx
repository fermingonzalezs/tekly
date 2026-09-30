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
      <RevealStagger className="mx-auto grid max-w-[100rem] grid-cols-1 gap-6 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 xl:px-12">
        {STATS.map((stat) => (
          <RevealItem key={stat.title} className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent transition-transform duration-200 hover:scale-110">
              <stat.icon className="h-5 w-5" strokeWidth={2} />
            </span>
            <div>
              <p className="text-sm font-semibold text-neutral-900">
                {stat.title}
              </p>
              <p className="mt-0.5 text-[13px] leading-snug text-neutral-500">
                {stat.detail}
              </p>
            </div>
          </RevealItem>
        ))}
      </RevealStagger>
    </section>
  );
}
