import { Building2, Radio, ShieldCheck, Users } from "lucide-react";
import { Reveal } from "./ui/reveal";

const STATS = [
  {
    icon: Building2,
    title: "Multi-organización",
    detail: "Cada negocio, su propio espacio y sus datos aislados",
  },
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
  {
    icon: ShieldCheck,
    title: "Seguro por organización",
    detail: "Row Level Security en base de datos, no solo en la pantalla",
  },
];

/**
 * Franja de confianza. Todavía no hay clientes reales para mostrar, así que
 * en vez de logos inventados van datos factuales del producto.
 */
export function MarketingLogosStrip() {
  return (
    <section className="border-y border-neutral-200/80 bg-white/60">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        {STATS.map((stat) => (
          <Reveal key={stat.title} className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
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
          </Reveal>
        ))}
      </div>
    </section>
  );
}
