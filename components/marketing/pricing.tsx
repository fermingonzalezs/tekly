import { Check } from "lucide-react";
import { RevealItem, RevealStagger } from "./ui/reveal";
import { GLASS } from "./ui/glass";
import { SectionHeading, SECTION_WRAP } from "./ui/section-heading";
import { signupUrl } from "@/lib/marketing/app-url";
import { cn } from "@/lib/utils";

/**
 * Precios: el sistema todavía no tiene planes de pago reales (organizations.plan
 * es un texto libre en 'free', sin tiers ni billing implementado, ver
 * CLAUDE.md "Backend y multi-tenancy"). Esta sección es un placeholder
 * visual con valores de referencia -- marcado explícitamente como
 * provisorio (ver aviso debajo del título) hasta que se defina el pricing
 * real. No prometer nada que el producto no soporte hoy (ej. multi-local:
 * un usuario pertenece a una sola organización, no hay esa capacidad).
 */

const PLANES = [
  {
    nombre: "Starter",
    precio: "14.990",
    resumen: "Para quien arranca solo y quiere ordenarse.",
    features: ["1 usuario", "Los 6 módulos", "Soporte por email"],
    cta: "Probar gratis",
    destacado: false,
  },
  {
    nombre: "Business",
    precio: "24.990",
    resumen: "Para equipos que trabajan todo el día en el local.",
    features: [
      "Usuarios ilimitados",
      "Los 6 módulos",
      "Soporte prioritario por WhatsApp",
      "Capacitación inicial para tu equipo",
    ],
    cta: "Probar gratis",
    destacado: true,
  },
  {
    nombre: "Business+",
    precio: "39.990",
    resumen: "Para equipos grandes que necesitan acompañamiento cercano.",
    features: [
      "Usuarios ilimitados",
      "Los 6 módulos",
      "Onboarding 1 a 1",
      "Soporte dedicado",
    ],
    cta: "Probar gratis",
    destacado: false,
  },
];

export function MarketingPricing() {
  return (
    <section id="precios" className={`${SECTION_WRAP} flex scroll-mt-20 flex-col gap-12 pb-20 sm:pb-36`}>
      <SectionHeading
        layout="center"
        eyebrow="Precios"
        title="Un plan para cada tamaño"
        lead="Los seis módulos en todos los planes. Cambiás de plan cuando tu negocio crece."
      />

      <RevealStagger className="grid items-stretch gap-[18px] lg:grid-cols-3">
        {PLANES.map((plan) => (
          <RevealItem key={plan.nombre} className="h-full">
            <div
              className={cn(
                "relative flex h-full flex-col gap-[22px] rounded-[26px] p-[30px]",
                plan.destacado
                  ? "bg-[#16151f] text-white shadow-[0_30px_60px_-28px_rgba(22,21,31,.55)]"
                  : GLASS,
              )}
            >
              {plan.destacado && (
                <span className="absolute right-[26px] top-[26px] rounded-full bg-accent px-2.5 py-[5px] text-[11px] font-semibold tracking-[.04em]">
                  MÁS ELEGIDO
                </span>
              )}
              <div className="flex flex-col gap-1.5">
                <h3 className="text-lg font-semibold">{plan.nombre}</h3>
                <p className={cn("text-sm", plan.destacado ? "text-white/70" : "text-neutral-600")}>
                  {plan.resumen}
                </p>
              </div>

              <p className="flex items-baseline gap-1.5">
                <span className={cn("text-sm", plan.destacado ? "text-white/60" : "text-neutral-500")}>
                  ARS
                </span>
                <span className="font-display text-5xl font-extrabold tabular-nums tracking-[-0.03em]">
                  {plan.precio}
                </span>
                <span className={cn("text-sm", plan.destacado ? "text-white/60" : "text-neutral-500")}>
                  /mes
                </span>
              </p>

              <ul className="flex flex-col gap-2.5 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        plan.destacado ? "text-[var(--chart-4)]" : "text-accent",
                      )}
                      strokeWidth={2.5}
                    />
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href={signupUrl()}
                className={cn(
                  "mt-auto rounded-full p-3.5 text-center text-[15px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                  plan.destacado
                    ? "bg-accent text-white hover:bg-[var(--chart-1)]"
                    : "border border-neutral-900/10 bg-white/80 text-neutral-900 hover:bg-white",
                )}
              >
                {plan.cta}
              </a>
            </div>
          </RevealItem>
        ))}
      </RevealStagger>

      <p className="text-center text-[13px] text-neutral-500">
        Precios de referencia, se confirman antes del lanzamiento.
      </p>
    </section>
  );
}
