"use client";

import { useRef, type ReactNode } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ShoppingCart, CalendarClock, Wrench } from "lucide-react";

import { AnimatedWords } from "./ui/animated-words";
import { MockupTurnos } from "./ui/mockup-turnos";
import { GlassSpotlightCard } from "./ui/glass-spotlight-card";
import { MarketingButton } from "./ui/marketing-button";
import { MarketingEyebrow } from "./ui/marketing-eyebrow";
import { AmbientBlobs } from "./ui/ambient-blobs";
import { useReducedMotionSafe } from "./ui/use-reduced-motion";
import { signupUrl } from "@/lib/marketing/app-url";

/**
 * Hero de la landing: headline animado palabra por palabra + mockup con
 * parallax (2 capas a distinta velocidad, máx ~50px). Con
 * `prefers-reduced-motion` el parallax queda desactivado y el headline sale
 * completo sin animar.
 */

/**
 * Entrada fade+slide al montar. Con reduce renderiza un div plano (sin
 * framer de por medio): si se dejara el `motion.div` con `initial` cambiando
 * a undefined, framer dejaba el opacity:0 inline del primer render colgado
 * -- el div plano garantiza que no quede nada invisible.
 */
function FadeIn({
  delay,
  className,
  children,
}: {
  delay: number;
  className?: string;
  children: ReactNode;
}) {
  const reduced = useReducedMotionSafe();
  if (reduced) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  );
}

export function MarketingHero() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotionSafe();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  // Parallax suave: cada capa se mueve a distinta velocidad, máx ~50px.
  const yMockup = useTransform(scrollYProgress, [0, 1], [0, -28]);
  const yCardTop = useTransform(scrollYProgress, [0, 1], [0, -50]);
  const yCardBottom = useTransform(scrollYProgress, [0, 1], [0, -14]);

  return (
    <section className="relative flex flex-col justify-center overflow-hidden">
      {/* Fondo: gradientes suaves de marca (solo en la landing), a la
          deriva -- movimiento ambiente lento, no ligado al scroll. */}
      <AmbientBlobs
        blobs={[
          {
            className:
              "absolute -top-32 left-1/2 h-96 w-[42rem] max-w-full -translate-x-1/2 rounded-full bg-accent/15 blur-3xl",
            dx: 24,
            dy: -16,
            duration: 14,
          },
          {
            className:
              "absolute right-[-10rem] top-40 h-72 w-72 rounded-full bg-accent/10 blur-3xl",
            dx: -18,
            dy: 20,
            duration: 11,
          },
          {
            className:
              "absolute left-[-8rem] top-72 h-64 w-64 rounded-full bg-accent/10 blur-3xl",
            dx: 16,
            dy: -22,
            duration: 13,
          },
        ]}
      />

      <div
        ref={ref}
        className="mx-auto grid max-w-[100rem] items-center gap-10 px-4 py-12 sm:px-6 md:py-16 lg:grid-cols-2 lg:gap-12 xl:px-12 xl:gap-16"
      >
        <GlassSpotlightCard className="relative z-10 p-8 sm:p-10 lg:w-[135%] xl:w-[125%]">
          <MarketingEyebrow>
            Dejá de anotar tu stock en tres lugares distintos
          </MarketingEyebrow>

          <h1 className="mt-5 font-display text-5xl font-bold uppercase leading-[1.03] tracking-tight text-neutral-900 sm:text-6xl md:text-7xl lg:text-[4rem] xl:text-[4.6rem]">
            <AnimatedWords
              text="Mejor gestión,"
              className="block whitespace-nowrap"
            />
            <AnimatedWords
              text="menos problemas"
              className="block whitespace-nowrap"
              delay={0.1}
            />
          </h1>

          <FadeIn
            delay={0.45}
            className="mt-6 max-w-xl text-lg leading-relaxed text-neutral-600 sm:text-xl"
          >
            <p>
              Mantené tu negocio organizado: cargá la información una sola
              vez y se actualiza en tiempo real para que todo el equipo se
              entere.
            </p>
          </FadeIn>

          <FadeIn
            delay={0.6}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <MarketingButton href={signupUrl()} variant="primary">
              Probar gratis
            </MarketingButton>
            <MarketingButton href="#como-funciona" variant="outline">
              Ver cómo funciona
            </MarketingButton>
          </FadeIn>
        </GlassSpotlightCard>

        {/* Mockup con capas parallax */}
        <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
          <FadeIn delay={0.2}>
            <motion.div style={reduced ? undefined : { y: yMockup }}>
              <MockupTurnos className="rotate-[0.5deg]" />
            </motion.div>
          </FadeIn>

          {/* Tarjetas flotantes: mismo copy/ícono que arma `describe()`
              (lib/realtime.ts) y mismo estilo que el Toaster real
              (bg-blue-50 + text-accent en el ícono, title/detail con los
              mismos pesos) -- actor/cliente son nombres reales del seed
              (lib/mock-data.ts), no el usuario de la cuenta. */}
          <FadeIn
            delay={0.7}
            className="absolute -right-3 -top-6 hidden rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-xl shadow-neutral-900/5 sm:block"
          >
            <motion.div style={reduced ? undefined : { y: yCardTop }}>
              <div className="flex items-start gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-accent">
                  <ShoppingCart className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-medium leading-snug text-neutral-900">
                    Caro realizó una venta por U$ 735
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold text-neutral-500">
                    V-4821 · Juan Pérez
                  </p>
                </div>
              </div>
            </motion.div>
          </FadeIn>

          <FadeIn
            delay={0.9}
            className="absolute -bottom-6 -left-3 hidden rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-xl shadow-neutral-900/5 sm:block"
          >
            <motion.div style={reduced ? undefined : { y: yCardBottom }}>
              <div className="flex items-start gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-accent">
                  <CalendarClock className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-medium leading-snug text-neutral-900">
                    Nuevo turno · Diego Sánchez
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold text-neutral-500">
                    Deja reparación · hoy 15:00 · agendó Meli
                  </p>
                </div>
              </div>
            </motion.div>
          </FadeIn>

          <FadeIn
            delay={1.05}
            className="absolute -left-6 top-1/3 hidden rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-xl shadow-neutral-900/5 xl:block"
          >
            <motion.div style={reduced ? undefined : { y: yCardTop }}>
              <div className="flex items-start gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-accent">
                  <Wrench className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-medium leading-snug text-neutral-900">
                    Ticket #128 listo
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold text-neutral-500">
                    iPhone 12 · marcó Meli
                  </p>
                </div>
              </div>
            </motion.div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
