import { Check, Info } from "lucide-react";
import { Reveal, RevealItem, RevealStagger } from "./ui/reveal";
import { MarketingEyebrow } from "./ui/marketing-eyebrow";
import { MarketingButton } from "./ui/marketing-button";
import { signupUrl } from "@/lib/marketing/app-url";

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
    precio: "AR$ 14.990",
    resumen: "Para un local que recién arranca a ordenarse",
    features: ["Hasta 3 usuarios", "Soporte por email"],
    destacado: false,
  },
  {
    nombre: "Negocio",
    precio: "AR$ 24.990",
    resumen: "El más elegido por tiendas con equipo completo",
    features: ["Usuarios ilimitados", "Soporte prioritario"],
    destacado: true,
  },
  {
    nombre: "Negocio+",
    precio: "AR$ 39.990",
    resumen: "Para equipos grandes que quieren acompañamiento",
    features: ["Usuarios ilimitados", "Onboarding asistido 1 a 1"],
    destacado: false,
  },
];

export function MarketingPricing() {
  return (
    <section id="precios" className="scroll-mt-20">
      <div className="mx-auto max-w-[100rem] px-4 py-20 sm:px-6 sm:py-24 xl:px-12">
        <Reveal className="mx-auto max-w-2xl text-center">
          <MarketingEyebrow>Precios</MarketingEyebrow>
          <h2 className="mt-4 font-display text-5xl font-bold uppercase tracking-tight text-neutral-900 sm:text-6xl">
            Un plan para cada tamaño de negocio
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-neutral-600">
            Todos los planes incluyen el sistema completo: inventario,
            ventas, reparaciones, cajas, turnos y analíticas.
          </p>
          <p className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-[13px] text-neutral-500">
            <Info className="h-3.5 w-3.5 shrink-0" />
            Precios de referencia -- se confirman antes del lanzamiento.
          </p>
        </Reveal>

        <RevealStagger className="mx-auto mt-14 grid max-w-5xl gap-6 sm:grid-cols-3">
          {PLANES.map((plan) => (
            <RevealItem
              key={plan.nombre}
              className={`relative flex flex-col rounded-2xl border p-6 ${
                plan.destacado
                  ? "border-accent bg-white shadow-xl shadow-accent/15 sm:-translate-y-2"
                  : "border-neutral-200 bg-white"
              }`}
            >
              {plan.destacado && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                  Más elegido
                </span>
              )}

              <h3 className="font-display text-lg font-semibold text-neutral-900">
                {plan.nombre}
              </h3>
              <p className="mt-1 text-[13px] leading-snug text-neutral-500">
                {plan.resumen}
              </p>

              <p className="mt-5 flex items-baseline gap-1">
                <span className="font-display text-4xl font-bold tabular-nums text-neutral-900">
                  {plan.precio}
                </span>
                <span className="text-sm font-medium text-neutral-500">
                  /mes
                </span>
              </p>

              <ul className="mt-6 space-y-2.5">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-sm text-neutral-600"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    {feature}
                  </li>
                ))}
              </ul>

              <MarketingButton
                href={signupUrl()}
                variant={plan.destacado ? "primary" : "outline"}
                className="mt-7 w-full"
              >
                Probar gratis
              </MarketingButton>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  );
}
