"use client";

import { useEffect, useState, type ComponentType } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Boxes,
  ShoppingCart,
  Wrench,
  CalendarClock,
  Wallet,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { MockupInventario } from "./ui/mockup-inventario";
import { MockupBuscador } from "./ui/mockup-buscador";
import { MockupReparaciones } from "./ui/mockup-reparaciones";
import { MockupAnaliticas } from "./ui/mockup-analiticas";
import { ScreenCapture } from "./ui/screen-capture";
import { GlassSpotlightCard } from "./ui/glass-spotlight-card";
import { Reveal } from "./ui/reveal";
import { MarketingEyebrow } from "./ui/marketing-eyebrow";
import { useReducedMotionSafe } from "./ui/use-reduced-motion";

/**
 * "Un módulo para cada área", versión carousel: antes era una grilla de 6
 * tarjetas con solo ícono + texto; ahora cada módulo muestra una ilustración
 * "ventana completa" -- Turnos y Cajas ya son capturas reales de pantalla
 * (`ScreenCapture`, `public/turnos.mp4` / `movimientos_caja.mp4`); Ventas
 * reusa el mockup de Showcase (buscador) y Inventario/Reparaciones/
 * Analíticas son mockups ilustrados propios, mismo lenguaje visual
 * (`MockupChrome` + escala de texto 5-6.5px), hasta que haya grabación de
 * cada uno. La explicación de cada módulo vive en una tarjeta "liquid
 * glass" (`GlassSpotlightCard`, la misma del hero) superpuesta a la esquina
 * del mockup -- sibling absoluto, nunca hijo: su `overflow-hidden` la
 * recortaría.
 */

const AUTOPLAY_MS = 6000;

type Modulo = {
  key: string;
  icon: LucideIcon;
  title: string;
  detail: string;
  Mockup: ComponentType<{ className?: string }>;
};

/** Capturas reales en vez de la ilustración armada a mano -- Turnos y Cajas
 * ya migrados, el resto sigue con mockup hasta que haya grabación propia de
 * cada uno. */
function TurnosCapture({ className }: { className?: string }) {
  return <ScreenCapture src="/turnos.mp4" className={className} />;
}

function CajasCapture({ className }: { className?: string }) {
  return <ScreenCapture src="/movimientos_caja.mp4" className={className} />;
}

const MODULOS: Modulo[] = [
  {
    key: "inventario",
    icon: Boxes,
    title: "Inventario",
    detail:
      "Equipos únicos por IMEI, repuestos por modelo y accesorios por cantidad — cada tipo de stock con su propio control.",
    Mockup: MockupInventario,
  },
  {
    key: "ventas",
    icon: ShoppingCart,
    title: "Ventas",
    detail:
      "Métodos de pago y cajas personalizables, pago en canje de equipos, cuentas corrientes y comprobantes en PDF para el cliente.",
    Mockup: MockupBuscador,
  },
  {
    key: "reparaciones",
    icon: Wrench,
    title: "Reparaciones",
    detail:
      "Checklist de ingreso y egreso, catálogo de servicios y repuestos personalizable, y presupuestos a medida para cada cliente.",
    Mockup: MockupReparaciones,
  },
  {
    key: "turnos",
    icon: CalendarClock,
    title: "Turnos",
    detail:
      "Agenda semanal de compras, entregas, retiros y cotizaciones — todo el equipo sabe quién llega y para qué.",
    Mockup: TurnosCapture,
  },
  {
    key: "cajas",
    icon: Wallet,
    title: "Cajas",
    detail:
      "Varias cajas por moneda, cada una con su medio de pago, conciliación periódica para detectar diferencias a tiempo y el historial completo de cada movimiento.",
    Mockup: CajasCapture,
  },
  {
    key: "analiticas",
    icon: BarChart3,
    title: "Analíticas",
    detail:
      "Análisis integral del negocio: márgenes, facturación y comportamiento de tus clientes, en un solo lugar.",
    Mockup: MockupAnaliticas,
  },
];

const TOTAL = MODULOS.length;

const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 56 : -56 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -56 : 56 }),
};

function ModuloCopy({ modulo }: { modulo: Modulo }) {
  const Icon = modulo.icon;
  return (
    <>
      <div className="flex items-center gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent text-white">
          <Icon className="h-6 w-6" />
        </span>
        <h3 className="font-display text-xl font-bold uppercase tracking-tight text-neutral-900 md:text-2xl">
          {modulo.title}
        </h3>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-neutral-600 md:max-w-2xl md:text-[15px]">
        {modulo.detail}
      </p>
    </>
  );
}

export function MarketingModulesCarousel() {
  const reduced = useReducedMotionSafe();
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [paused, setPaused] = useState(false);

  function goTo(target: number) {
    setDirection(target > index ? 1 : -1);
    setIndex(((target % TOTAL) + TOTAL) % TOTAL);
  }

  // Autoplay: se reinicia con cada cambio de slide (manual o automático) y
  // se frena en hover/focus. `setIndex` funcional evita depender de
  // `index` para calcular el próximo valor (sin closures viejas).
  useEffect(() => {
    if (reduced || paused) return;
    const t = setTimeout(() => {
      setDirection(1);
      setIndex((i) => (i + 1) % TOTAL);
    }, AUTOPLAY_MS);
    return () => clearTimeout(t);
  }, [index, paused, reduced]);

  const activo = MODULOS[index];
  const Mockup = activo.Mockup;

  return (
    <section id="features" className="relative scroll-mt-20 overflow-hidden">
      <div className="mx-auto max-w-[100rem] px-4 py-20 sm:px-6 sm:py-24 xl:px-12">
        <Reveal className="mx-auto max-w-2xl text-center">
          <MarketingEyebrow>Módulos</MarketingEyebrow>
          <h2 className="mt-4 font-display text-5xl font-bold uppercase tracking-tight text-neutral-900 sm:text-6xl md:text-7xl">
            Un módulo para cada área
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-neutral-600">
            Seis módulos conectados entre sí, pero separados para que cada
            área trabaje sin pisarse. Mirá cómo se ve cada uno.
          </p>
        </Reveal>

        <Reveal className="mx-auto mt-14 w-full md:w-[85%]" delay={0.1}>
          <div
            className="relative"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            <div className="relative aspect-video w-full">
              {reduced ? (
                <Mockup className="h-full w-full" />
              ) : (
                <AnimatePresence initial={false} custom={direction}>
                  <motion.div
                    key={activo.key}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
                    className="absolute inset-0"
                  >
                    <Mockup className="h-full w-full" />
                  </motion.div>
                </AnimatePresence>
              )}
            </div>

            <GlassSpotlightCard className="relative z-20 mx-auto mt-5 w-full max-w-xl p-5 md:absolute md:-bottom-10 md:-left-10 md:mx-0 md:mt-0 md:w-[58%] md:max-w-none md:p-7">
              {reduced ? (
                <ModuloCopy modulo={activo} />
              ) : (
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={activo.key}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
                    <ModuloCopy modulo={activo} />
                  </motion.div>
                </AnimatePresence>
              )}
            </GlassSpotlightCard>
          </div>

          <div className="mt-10 flex items-center justify-center gap-4 md:mt-16">
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              aria-label="Módulo anterior"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-neutral-200 bg-white text-neutral-500 shadow-sm transition-colors hover:border-accent/50 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2">
              {MODULOS.map((m, i) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Ir al módulo ${m.title}`}
                  aria-current={i === index}
                  className={`h-2 rounded-full transition-all ${
                    i === index ? "w-8 bg-accent" : "w-2 bg-neutral-300 hover:bg-neutral-400"
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => goTo(index + 1)}
              aria-label="Módulo siguiente"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-neutral-200 bg-white text-neutral-500 shadow-sm transition-colors hover:border-accent/50 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
