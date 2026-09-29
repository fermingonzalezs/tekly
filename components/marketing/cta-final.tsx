"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Reveal } from "./ui/reveal";
import { MarketingButton } from "./ui/marketing-button";
import { useReducedMotionSafe } from "./ui/use-reduced-motion";
import { signupUrl } from "@/lib/marketing/app-url";

/**
 * Banner de cierre. El gradiente está permitido en la landing (ver plan: las
 * reglas "forbidden defaults" de la app de gestión no aplican al contexto de
 * marketing), igual que en el hero del AuthModal -- arma con las CSS vars de
 * la paleta activa (`--chart-*`, app/globals.css) en vez de hex fijos, para
 * seguir la paleta de marketing (violeta) en vez de quedar índigo a mano.
 */
export function MarketingCtaFinal() {
  const reduced = useReducedMotionSafe();

  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 pt-4 sm:px-6 sm:pb-24">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,var(--chart-1),var(--chart-2),var(--chart-3))] px-6 py-16 text-center sm:px-12 sm:py-20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
          >
            <motion.div
              className="absolute -left-20 -top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl"
              animate={reduced ? undefined : { x: [0, 20, 0], y: [0, 16, 0] }}
              transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute -bottom-28 -right-16 h-72 w-72 rounded-full bg-white/10 blur-3xl"
              animate={reduced ? undefined : { x: [0, -22, 0], y: [0, -18, 0] }}
              transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>

          <h2 className="relative font-grotesk text-4xl font-bold uppercase tracking-tight text-white sm:text-5xl">
            Empezá a gestionar tu tienda hoy mismo
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">
            Creá tu organización en un minuto, invitá a tu equipo y cargá tu
            stock. El resto del negocio queda registrado solo.
          </p>

          <MarketingButton
            href={signupUrl()}
            variant="white"
            size="lg"
            className="relative mt-8"
          >
            Empezá gratis
            <ArrowRight className="h-4 w-4" />
          </MarketingButton>

          <p className="relative mt-5 text-xs text-white/70">
            Sin instalación: funciona en el navegador, con los datos de tu
            organización aislados de los demás.
          </p>
        </div>
      </Reveal>
    </section>
  );
}
