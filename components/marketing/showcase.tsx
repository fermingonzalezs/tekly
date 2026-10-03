"use client";

import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
} from "framer-motion";
import { Wallet, ShoppingCart } from "lucide-react";
import { MockupCajas } from "./ui/mockup-cajas";
import { MockupBuscador } from "./ui/mockup-buscador";
import { Reveal } from "./ui/reveal";
import { MarketingEyebrow } from "./ui/marketing-eyebrow";
import { useReducedMotionSafe } from "./ui/use-reduced-motion";

/**
 * Showcase: dos ilustraciones "ventana completa" lado a lado (Cajas +
 * buscador global con "Nueva venta"), cada una con su propia tarjeta de
 * notificación flotante en parallax. Con prefers-reduced-motion todo
 * queda estático.
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

      <div ref={ref} className="mx-auto max-w-[100rem] px-4 py-20 sm:px-6 sm:py-24 xl:px-12">
        <Reveal className="mx-auto max-w-2xl text-center">
          <MarketingEyebrow>Producto</MarketingEyebrow>
          <h2 className="mt-4 font-display text-5xl font-bold uppercase tracking-tight text-neutral-900 sm:text-6xl">
            Tu tienda entera, en una sola pantalla
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-neutral-600">
            Lo que tu equipo carga en ventas, reparaciones o caja aparece al
            instante en el dashboard y en las analíticas. Sin exportar
            planillas ni recopilar nada a mano.
          </p>
        </Reveal>

        <Reveal className="mx-auto mt-14 grid max-w-[90rem] gap-20 sm:grid-cols-2">
          <div className="relative">
            <motion.div style={reduced ? undefined : { y: yMockup }}>
              <MockupCajas />
            </motion.div>
            <p className="mt-4 text-center text-sm font-medium text-neutral-500">
              Cada caja conciliada, sin sorpresas
            </p>

            <motion.div
              style={reduced ? undefined : { y: yCardLeft }}
              className="absolute -left-4 -top-6 hidden rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-xl shadow-neutral-900/5 md:-left-8 md:block"
            >
              <div className="flex items-center gap-2.5">
                <Wallet className="h-4 w-4 text-accent" />
                <div>
                  <p className="text-xs font-semibold text-neutral-900">
                    Caja conciliada
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    Diferencia: U$ 0
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="relative">
            <motion.div style={reduced ? undefined : { y: yMockup }}>
              <MockupBuscador />
            </motion.div>
            <p className="mt-4 text-center text-sm font-medium text-neutral-500">
              Buscá cualquier cosa, o creala al toque
            </p>

            <motion.div
              style={reduced ? undefined : { y: yCardRight }}
              className="absolute -right-4 -top-6 hidden rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-xl shadow-neutral-900/5 md:-right-8 md:block"
            >
              <div className="flex items-center gap-2.5">
                <ShoppingCart className="h-4 w-4 text-accent" />
                <div>
                  <p className="text-xs font-semibold text-neutral-900">
                    Venta creada
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    Desde el buscador · U$ 690
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
