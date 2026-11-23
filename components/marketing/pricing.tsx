"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Tabs } from "@/components/ui/tabs";
import { MESES_PAGOS_ANUAL, precioCiclo, type Ciclo, type PlanId } from "@/lib/planes";
import { RevealItem, RevealStagger } from "./ui/reveal";
import { GLASS } from "./ui/glass";
import { SectionHeading, SECTION_WRAP } from "./ui/section-heading";
import { signupUrl } from "@/lib/marketing/app-url";
import { cn } from "@/lib/utils";

/**
 * Precios: montos, ciclo mensual/anual, límites de usuarios y la prueba de 30
 * días sin tarjeta salen de `lib/planes.ts` (los mismos que cobra Mercado Pago
 * en /plan); acá solo van los textos de cada plan. No prometer nada que el
 * producto no soporte hoy (ej. multi-local: un usuario pertenece a una sola
 * organización).
 */

const PLANES_LANDING: { id: PlanId; nombre: string; resumen: string; features: string[]; cta: string; destacado: boolean }[] = [
  {
    id: "starter",
    nombre: "Starter",
    resumen: "Para quien arranca solo y quiere ordenarse.",
    features: ["1 usuario", "Los 6 módulos", "Soporte por email"],
    cta: "Probar gratis",
    destacado: false,
  },
  {
    id: "business",
    nombre: "Business",
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
    id: "business_plus",
    nombre: "Business+",
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

const fmtPrecio = (n: number) => n.toLocaleString("es-AR");

export function MarketingPricing() {
  const [ciclo, setCiclo] = useState<Ciclo>("mensual");
  return (
    <section id="precios" className={`${SECTION_WRAP} flex scroll-mt-20 flex-col gap-12 pb-20 sm:pb-36`}>
      <SectionHeading
        layout="center"
        eyebrow="Precios"
        title="Un plan para cada tamaño"
        lead="Los seis módulos en todos los planes. Cambiás de plan cuando tu negocio crece."
      />

      <div className="-mt-4 flex justify-center">
        <Tabs
          value={ciclo}
          onChange={setCiclo}
          options={[
            { value: "mensual", label: "Mensual" },
            { value: "anual", label: `Anual · ${12 - MESES_PAGOS_ANUAL} meses gratis` },
          ]}
        />
      </div>

      <RevealStagger className="grid items-stretch gap-[18px] lg:grid-cols-3">
        {PLANES_LANDING.map((plan) => (
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

              <div className="flex flex-col items-center gap-1">
                <p className="flex items-baseline justify-center gap-1.5">
                  <span className={cn("text-base", plan.destacado ? "text-white/60" : "text-neutral-500")}>
                    ARS
                  </span>
                  <span
                    className={cn(
                      "font-display font-extrabold tabular-nums tracking-[-0.03em]",
                      ciclo === "anual" ? "text-5xl sm:text-6xl" : "text-6xl sm:text-7xl",
                    )}
                  >
                    {fmtPrecio(precioCiclo(plan.id, ciclo)!)}
                  </span>
                  <span className={cn("text-base", plan.destacado ? "text-white/60" : "text-neutral-500")}>
                    {ciclo === "anual" ? "/año" : "/mes"}
                  </span>
                </p>
                {ciclo === "anual" && (
                  <p className={cn("text-sm", plan.destacado ? "text-white/70" : "text-neutral-600")}>
                    Equivale a ARS {fmtPrecio(Math.round(precioCiclo(plan.id, "anual")! / 12))}/mes
                  </p>
                )}
              </div>

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
        30 días de prueba gratis con el plan Starter, sin tarjeta. Pagás con Mercado Pago, mensual o anual.
      </p>
    </section>
  );
}
