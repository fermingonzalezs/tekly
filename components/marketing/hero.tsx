"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  CirclePlay,
  Package,
  ShoppingCart,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { AnimatedWords } from "./ui/animated-words";
import { MarketingButton } from "./ui/marketing-button";
import { GLASS_STRONG } from "./ui/glass";
import { SECTION_WRAP } from "./ui/section-heading";
import { useReducedMotionSafe } from "./ui/use-reduced-motion";
import { Delta } from "@/components/ui/stat-card";
import { CHART_ACCENT, GHOST_STRIPES } from "@/lib/chart";
import { demoUrl, signupUrl } from "@/lib/marketing/app-url";

/**
 * Hero de la landing: headline + CTAs a la izquierda, y a la derecha un feed
 * de "Actividad · Hoy" que imita las notificaciones en tiempo real de la app
 * (mismos eventos que `describe()` en lib/realtime.ts: venta, ticket listo,
 * ingreso de stock, turno). Estático a propósito: una versión que rotaba en
 * loop distraía. Todos los datos son de ejemplo.
 */

type Evento = {
  icon: LucideIcon;
  title: string;
  detail: string;
  actor: "CA" | "ME" | "JU";
};

const EVENTOS: Evento[] = [
  { icon: ShoppingCart, title: "Venta V-4821 · U$ 735", detail: "Mercadería + efectivo + transferencia", actor: "CA" },
  { icon: Wrench, title: "Ticket #128 listo para retirar", detail: "Cambio de batería · checklist de egreso OK", actor: "ME" },
  { icon: Package, title: "Ingreso a stock · 3 equipos", detail: "IMEI cargados · 128 y 256 GB", actor: "CA" },
  { icon: CalendarDays, title: "Nuevo turno · Diego Sánchez", detail: "Hoy 15:00 · deja equipo para reparación", actor: "ME" },
];

const TIEMPOS = ["ahora", "2 min", "6 min", "12 min"];

const AVATAR: Record<Evento["actor"], string> = {
  CA: "bg-accent-soft text-[var(--chart-1)]",
  ME: "bg-neutral-100 text-neutral-700",
  JU: "bg-accent/15 text-[var(--chart-0)]",
};

// Ventas de la semana (U$), último = hoy.
const SEMANA = [480, 620, 390, 750, 570, 890, 1000];

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
  if (reduced) return <div className={className}>{children}</div>;
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

function LiveFeed() {
  return (
    <ul className="flex flex-col gap-2.5">
      {EVENTOS.map((ev, i) => {
        const Icon = ev.icon;
        const nuevo = i === 0;
        return (
          <li
            key={ev.title}
            className={`flex items-center gap-3.5 rounded-[18px] p-3.5 ${
              nuevo
                ? "border border-accent/30 bg-white shadow-[0_8px_20px_-12px_rgb(var(--accent-rgb)/0.45)]"
                : "border border-neutral-900/[.06] bg-white/75"
            }`}
          >
            <span
              className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[13px] ${
                nuevo ? "bg-accent text-white" : "bg-accent-soft text-accent"
              }`}
            >
              <Icon className="h-5 w-5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-semibold tabular-nums max-sm:leading-snug sm:truncate">
                {ev.title}
              </span>
              <span className="text-[13px] text-neutral-500 max-sm:leading-snug sm:truncate">
                {ev.detail}
              </span>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span
                className={`flex h-[26px] w-[26px] items-center justify-center rounded-full text-[11px] font-semibold ${AVATAR[ev.actor]}`}
              >
                {ev.actor}
              </span>
              <span className="text-[11px] text-neutral-500">{TIEMPOS[i]}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Mini barras de la semana, mismo lenguaje que `TrendChart` del dashboard:
 * barras en reposo con el rayado `GHOST_STRIPES`, la de hoy rellena con el
 * accent. */
function SemanaChart() {
  const max = Math.max(...SEMANA);
  return (
    <div
      className="flex h-14 shrink-0 items-end gap-1 sm:gap-1.5"
      role="img"
      aria-label="Ventas diarias de la semana"
    >
      {SEMANA.map((v, i) => {
        const hoy = i === SEMANA.length - 1;
        return (
          <span
            key={i}
            className={`w-2.5 rounded-t-md sm:w-3 ${hoy ? "" : "border border-neutral-300"}`}
            style={{
              height: `${(v / max) * 100}%`,
              background: hoy ? CHART_ACCENT : GHOST_STRIPES,
            }}
          />
        );
      })}
    </div>
  );
}

export function MarketingHero() {
  return (
    <section className={`${SECTION_WRAP} flex flex-wrap items-center gap-10 pb-16 pt-10 sm:gap-14 sm:pb-24 sm:pt-12 md:pt-[72px] min-[2000px]:gap-24`}>
      <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-7">
        <FadeIn delay={0} className="self-start">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-white/70 py-[7px] pl-2 pr-3.5 text-[13px] font-medium text-[var(--chart-1)]">
            <span className="rounded-full bg-accent px-2 py-[3px] text-[11px] font-semibold tracking-[.04em] text-white">
              NUEVO
            </span>
            Gestión para locales de venta y servicio técnico
          </span>
        </FadeIn>

        <h1 className="font-display text-[min(3rem,calc((100vw-2rem)/7.6))] sm:text-[clamp(3rem,6.4vw,5.75rem)] min-[2000px]:text-[7rem] font-extrabold uppercase leading-[.92] tracking-[-0.035em]">
          <AnimatedWords text="Mejor organización," className="block" />
          <AnimatedWords
            text="menos problemas."
            className="block text-accent"
            delay={0.1}
          />
        </h1>

        <FadeIn delay={0.45}>
          <p className="max-w-[520px] text-[19px] leading-relaxed text-neutral-600">
            Mantené tu negocio organizado: cargá cada venta, reparación y
            movimiento de caja una sola vez, y{" "}
            <strong className="font-semibold text-neutral-900">
              todo el equipo lo ve al instante.
            </strong>
          </p>
        </FadeIn>

        <FadeIn delay={0.6} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <MarketingButton href={signupUrl()} variant="primary" className="w-full sm:w-auto">
            Probar gratis
          </MarketingButton>
          <MarketingButton href="#como-funciona" variant="outline" className="w-full gap-2 sm:w-auto">
            <CirclePlay className="h-4 w-4" />
            Ver cómo funciona
          </MarketingButton>
          <MarketingButton href={demoUrl()} variant="outline" className="w-full sm:w-auto">
            Ver demo
          </MarketingButton>
        </FadeIn>

        <FadeIn
          delay={0.75}
          className="flex max-w-[520px] flex-wrap items-center gap-2.5 border-t border-neutral-900/[.08] pt-3.5"
        >
          <span className="mr-1 w-full text-[13px] text-neutral-500 sm:w-auto">
            Un acceso para cada rol
          </span>
          {["Admin", "Vendedor", "Técnico"].map((rol) => (
            <span
              key={rol}
              className="rounded-full border border-neutral-900/[.08] bg-white px-3 py-1.5 text-[13px] font-medium"
            >
              {rol}
            </span>
          ))}
        </FadeIn>
      </div>

      {/* Feed en vivo. Las formas sólidas de atrás (silueta de equipo +
          cuadrado accent) existen para que el blur del vidrio se note. */}
      <FadeIn
        delay={0.3}
        className="relative flex min-w-0 flex-[1_1_440px] justify-center py-6"
      >
        <div
          aria-hidden="true"
          className="absolute -top-2.5 right-[6%] h-[500px] w-[250px] rotate-[8deg] rounded-[52px] border-[10px] border-accent/25 bg-accent-soft"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-1.5 left-[4%] h-[120px] w-[120px] -rotate-[10deg] rounded-[32px] bg-accent/90"
        />

        <div className={`relative w-full max-w-[480px] rounded-[28px] min-[2000px]:max-w-[540px] p-[22px] ${GLASS_STRONG}`}>
          <div className="flex items-center justify-between px-1 pb-4 pt-0.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium uppercase tracking-[.08em] text-neutral-500">
                Actividad · Hoy
              </span>
              <span className="font-display text-xl font-bold tracking-[-0.01em]">
                Sucursal Centro
              </span>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/15 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--chart-1)]">
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              En vivo
            </span>
          </div>

          <LiveFeed />

          <div className="mt-3.5 flex items-end justify-between gap-3 rounded-[18px] border border-neutral-900/[.06] bg-white/75 px-3.5 pb-3 pt-3.5">
            <div className="flex flex-col gap-1">
              <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Ventas de la semana
              </span>
              <span className="font-grotesk text-2xl font-semibold leading-none tabular-nums">
                U$ 4.700
              </span>
              <span className="flex items-center gap-1.5 whitespace-nowrap text-[11px] text-neutral-500">
                <Delta value={12} className="px-1.5 py-0.5 text-[10px]" />
                vs semana pasada
              </span>
            </div>
            <SemanaChart />
          </div>
        </div>
      </FadeIn>
    </section>
  );
}
