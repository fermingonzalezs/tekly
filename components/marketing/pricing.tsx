import { Check } from "lucide-react";
import { RevealItem, RevealStagger } from "./ui/reveal";
import { GLASS } from "./ui/glass";
import { SectionHeading, SECTION_WRAP } from "./ui/section-heading";
import { signupUrl } from "@/lib/marketing/app-url";
import { cn } from "@/lib/utils";

/**
 * Precios: los límites de usuarios y la prueba de 14 días sin tarjeta son
 * reales (`lib/planes.ts`, plan 015). Los montos siguen siendo provisorios
 * (aviso debajo) y el cobro es por transferencia, sin checkout. Mantener
 * `PLANES` de acá alineado con `lib/planes.ts`. No prometer nada que el
 * producto no soporte hoy (ej. multi-local: un usuario pertenece a una sola
 * organización).
 */

const PLANES = [
  {
    nombre: "Starter",
    precio: "29.990",
    resumen: "Para quien arranca solo y quiere ordenarse.",
    features: ["1 usuario", "Los 6 módulos", "Soporte por email"],
    cta: "Probar gratis",
    destacado: false,
  },
  {
    nombre: "Business",
    precio: "49.990",
    resumen: "Para celulares que trabajan todo el día en el local.",
    features: [
      "Hasta 3 usuarios",
      "Los 6 módulos",
      "Soporte prioritario por WhatsApp",
      "Capacitación inicial para tu equipo",
    ],
    cta: "Probar gratis",
    destacado: true,
  },
  {
    nombre: "Business+",
    precio: "99.990",
    resumen: "Para celulares grandes que necesitan acompañamiento cercano.",
    features: [
      "Hasta 10 usuarios",
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
                "relative flex h-full flex-col gap-7 rounded-[26px] p-[34px] sm:min-h-[520px] lg:min-h-[600px]",
                plan.destacado
                  ? "bg-[#16151f] text-white shadow-[0_30px_60px_-28px_rgba(22,21,31,.55)]"
                  : GLASS,
              )}
            >
              {plan.destacado && (
                <span className="absolute inset-x-0 -top-3 flex justify-center">
                  <span className="rounded-full bg-accent px-3 py-[5px] text-[11px] font-semibold tracking-[.04em] text-white">
                    MÁS ELEGIDO
                  </span>
                </span>
              )}
              <div className="flex min-h-[5.5rem] flex-col items-center gap-1.5 text-center">
                <h3 className="text-lg font-semibold">{plan.nombre}</h3>
                <p className={cn("text-sm", plan.destacado ? "text-white/70" : "text-neutral-600")}>
                  {plan.resumen}
                </p>
              </div>

              <p className="flex items-baseline justify-center gap-1.5">
                <span className={cn("text-base", plan.destacado ? "text-white/60" : "text-neutral-500")}>
                  ARS
                </span>
                <span className="font-display text-6xl font-extrabold tabular-nums tracking-[-0.03em] sm:text-7xl">
                  {plan.precio}
                </span>
                <span className={cn("text-base", plan.destacado ? "text-white/60" : "text-neutral-500")}>
                  /mes
                </span>
              </p>

              <hr className={cn("border-0 border-t", plan.destacado ? "border-white/15" : "border-neutral-900/10")} />

              <div className="flex flex-1 items-start">
                <ul className="flex w-full flex-col gap-4 text-start text-base">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check
                        className={cn(
                          "mt-1 h-[18px] w-[18px] shrink-0",
                          plan.destacado ? "text-[var(--chart-4)]" : "text-accent",
                        )}
                        strokeWidth={2.5}
                      />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <a
                href={signupUrl()}
                className={cn(
                  "rounded-full p-3.5 text-center text-[15px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
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
        14 días de prueba gratis, sin tarjeta. Precios de referencia, se confirman antes del lanzamiento.
      </p>
    </section>
  );
}
