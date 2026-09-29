"use client";

import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
} from "framer-motion";
import { CalendarDays, CheckCircle2, Wrench } from "lucide-react";
import { MockupDashboard } from "./ui/mockup-dashboard";
import { Reveal } from "./ui/reveal";
import { useReducedMotionSafe } from "./ui/use-reduced-motion";

/**
 * Showcase: el MockupDashboard del hero en otra composición (más grande,
 * centrado), con las tarjetas de notificaciones en parallax a distinta
 * velocidad (máx ~60px entre capas, ver plan). Con prefers-reduced-motion
 * todo queda estático.
 */

export function MarketingShowcase() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotionSafe();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const yGlow = useTransform(scrollYProgress, [0, 1], [60, -60]);
  const yMockup = useTransform(scrollYProgress, [0, 1], [12, -12]);
  const yCardLeft = useTransform(scrollYProgress, [0, 1], [42, -42]);
  const yCardRight = useTransform(scrollYProgress, [0, 1], [-24, 24]);
  const yCardBottom = useTransform(scrollYProgress, [0, 1], [30, -30]);

  return (
    <section id="producto" className="relative scroll-mt-20 overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute left-1/2 top-24 -translate-x-1/2">
          <motion.div
            style={reduced ? undefined : { y: yGlow }}
            className={`h-80 w-[36rem] max-w-none rounded-full bg-accent/10 blur-3xl ${
              reduced ? "" : "animate-pulse [animation-duration:6s]"
            }`}
          />
        </div>
      </div>

      <div ref={ref} className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">
            Producto
          </p>
          <h2 className="mt-3 font-grotesk text-4xl font-bold uppercase tracking-tight text-neutral-900 sm:text-5xl">
            Tu tienda entera, en una sola pantalla
          </h2>
          <p className="mt-4 text-base leading-relaxed text-neutral-600">
            Lo que tu equipo carga en ventas, reparaciones o caja aparece al
            instante en el dashboard y en las analíticas. Sin exportar
            planillas ni recopilar nada a mano.
          </p>
        </Reveal>

        <Reveal className="relative mx-auto mt-14 max-w-2xl">
          <motion.div style={reduced ? undefined : { y: yMockup }}>
            <MockupDashboard />
          </motion.div>

          <motion.div
            style={reduced ? undefined : { y: yCardLeft }}
            className="absolute -left-4 -top-8 hidden rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-xl shadow-neutral-900/5 sm:block md:-left-10"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <div>
                <p className="text-xs font-semibold text-neutral-900">
                  Venta confirmada
                </p>
                <p className="text-[11px] text-neutral-500">
                  U$ 1.150 · V-1042 · iPhone 13 Pro
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            style={reduced ? undefined : { y: yCardRight }}
            className="absolute -right-4 top-1/4 hidden rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-xl shadow-neutral-900/5 sm:block md:-right-10"
          >
            <div className="flex items-center gap-2.5">
              <CalendarDays className="h-4 w-4 text-accent" />
              <div>
                <p className="text-xs font-semibold text-neutral-900">
                  Turno agendado
                </p>
                <p className="text-[11px] text-neutral-500">
                  Deja equipo · mañana 10:30
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            style={reduced ? undefined : { y: yCardBottom }}
            className="absolute -bottom-8 left-10 hidden rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-xl shadow-neutral-900/5 sm:block"
          >
            <div className="flex items-center gap-2.5">
              <Wrench className="h-4 w-4 text-accent" />
              <div>
                <p className="text-xs font-semibold text-neutral-900">
                  Ticket #128 listo
                </p>
                <p className="text-[11px] text-neutral-500">
                  iPhone 12 · batería cambiada
                </p>
              </div>
            </div>
          </motion.div>
        </Reveal>
      </div>
    </section>
  );
}
