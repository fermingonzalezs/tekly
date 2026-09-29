import { Radio, Users } from "lucide-react";
import { RevealItem, RevealStagger } from "./ui/reveal";

const STATS = [
  {
    icon: Users,
    title: "3 roles",
    detail: "Admin, vendedor y técnico: cada quien ve lo suyo",
  },
  {
    icon: Radio,
    title: "Todo en tiempo real",
    detail: "Lo que carga tu equipo, lo ves al instante",
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
      <RevealStagger className="mx-auto grid max-w-2xl grid-cols-1 gap-6 px-4 py-10 sm:grid-cols-2 sm:px-6">
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
