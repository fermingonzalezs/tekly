import type { ReactNode } from "react";
import { RevealItem, RevealStagger } from "./ui/reveal";
import { GLASS, GLASS_INNER } from "./ui/glass";
import { SectionHeading, SECTION_WRAP } from "./ui/section-heading";
import { chartColor, GHOST_STRIPES, heatCell, HEAT_SCALE } from "@/lib/chart";
import { checklistItemLabel, dotClass, equipoStatus, medioPago } from "@/lib/status";
import type { ChecklistItemId, EquipoStatus, EstadoChecklistItem, MedioPagoVenta } from "@/lib/types";
import { fmtUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Módulos: grilla de 6 tarjetas de vidrio, una por área. Cada una lleva una
 * mini-vista con el MISMO lenguaje visual que la sección real de la app (no
 * un dibujo genérico): chip gris + punto de estado (`dotClass`) como en las
 * tablas, barra de stock con pista `GHOST_STRIPES` como en Inventario,
 * botones bien/mal/no aplica del `ChecklistEditor`, heatmap de turnos con
 * `heatCell` como en el dashboard, tabla de conciliación con los estilos
 * globales de tabla. Datos de ejemplo.
 */

// ── Mini-vistas ───────────────────────────────────────────────

/** Chip de estado de tabla (patrón de la app: gris neutro + punto de color). */
function EstadoChip({ estado }: { estado: EquipoStatus }) {
  const est = equipoStatus[estado];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
      <span className={cn("h-1.5 w-1.5 rounded-full", dotClass[est.tone])} />
      {est.label}
    </span>
  );
}

function InventarioVista() {
  const stock = 2;
  const minimo = 5;
  return (
    <div className={cn(GLASS_INNER, "px-3.5 py-1.5")}>
      {(
        [
          { nombre: "Equipo 256 GB · grafito", imei: "···7730", estado: "disponible" },
          { nombre: "Equipo 128 GB · azul", imei: "···1042", estado: "reservado" },
        ] as const
      ).map((e) => (
        <div
          key={e.imei}
          className="flex items-center justify-between gap-3 border-b border-neutral-900/[.06] py-2.5"
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[13px] font-semibold">{e.nombre}</span>
            <span className="font-mono text-[11px] text-neutral-500">IMEI {e.imei}</span>
          </div>
          <EstadoChip estado={e.estado} />
        </div>
      ))}
      <div className="py-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[13px] font-semibold">Batería · repuesto</span>
          <span className="text-xs tabular-nums text-neutral-500">
            <span className="font-semibold text-neutral-900">{stock}</span> / mín {minimo}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ background: GHOST_STRIPES }}>
          <div className="h-full rounded-full bg-amber-500" style={{ width: `${(stock / minimo) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

const PAGOS: { medio: MedioPagoVenta; montoUsd: number }[] = [
  { medio: "canje", montoUsd: 340 },
  { medio: "pesos", montoUsd: 250 },
  { medio: "transferencia", montoUsd: 145 },
];

/** Pago dividido: barra apilada con la paleta de gráficos y separadores
 * blancos (mismo criterio que la dona del dashboard), leyenda en tinta. */
function VentasVista() {
  const total = PAGOS.reduce((a, p) => a + p.montoUsd, 0);
  return (
    <div className={cn(GLASS_INNER, "flex flex-col gap-3 p-4")}>
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="text-neutral-500">Total V-4821</span>
        <span className="font-grotesk text-base font-semibold tabular-nums">{fmtUsd(total)}</span>
      </div>
      <div
        className="flex h-4 overflow-hidden rounded-full"
        role="img"
        aria-label={`Pago dividido: ${PAGOS.map((p) => `${medioPago[p.medio].label} ${fmtUsd(p.montoUsd)}`).join(", ")}`}
      >
        {PAGOS.map((p, i) => (
          <span
            key={p.medio}
            className={cn("h-full", i > 0 && "border-l-2 border-white")}
            style={{ flex: p.montoUsd, background: chartColor(i + 1) }}
          />
        ))}
      </div>
      <ul className="flex flex-col gap-1.5 text-xs text-neutral-700">
        {PAGOS.map((p, i) => (
          <li key={p.medio} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-sm" style={{ background: chartColor(i + 1) }} />
            {medioPago[p.medio].label}
            <span className="ml-auto font-semibold tabular-nums">{fmtUsd(p.montoUsd)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const CHECKLIST: { id: ChecklistItemId; estado: EstadoChecklistItem }[] = [
  { id: "enciende", estado: "bien" },
  { id: "modulo", estado: "bien" },
  { id: "faceId", estado: "mal" },
  { id: "camaraTrasera", estado: "na" },
];

// Mismos colores que `ESTADO_BTN_ACTIVO` de components/ui/checklist-editor.tsx
// (no exportado: es un módulo "use client" y esto es server component).
const ESTADO_ACTIVO: Record<EstadoChecklistItem, string> = {
  bien: "bg-emerald-500 text-white",
  mal: "bg-red-500 text-white",
  na: "bg-neutral-400 text-white",
};
const ESTADO_LABEL: Record<EstadoChecklistItem, string> = {
  bien: "Bien",
  mal: "Mal",
  na: "N/A",
};

/** Checklist de ingreso con los botones bien/mal/no aplica del
 * `ChecklistEditor` real (versión compacta, no interactiva). */
function ReparacionesVista() {
  return (
    <div className={cn(GLASS_INNER, "flex flex-col gap-2 p-4")}>
      <div className="flex justify-between text-[13px]">
        <span className="font-semibold">Ticket #128 · checklist de ingreso</span>
      </div>
      {CHECKLIST.map((c) => (
        <div key={c.id} className="flex items-center justify-between gap-3 text-[13px]">
          <span className="truncate text-neutral-700">{checklistItemLabel[c.id]}</span>
          <span className="flex shrink-0 gap-1">
            {(["bien", "mal", "na"] as const).map((e) => (
              <span
                key={e}
                className={cn(
                  "w-10 rounded-md py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide",
                  c.estado === e ? ESTADO_ACTIVO[e] : "bg-neutral-100 text-neutral-500",
                )}
              >
                {ESTADO_LABEL[e]}
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

const DIAS = ["lun", "mar", "mié", "jue", "vie"];
const FRANJAS: { label: string; turnos: number[] }[] = [
  { label: "Mañana", turnos: [3, 1, 2, 0, 4] },
  { label: "Tarde", turnos: [2, 5, 1, 3, 2] },
  { label: "Noche", turnos: [0, 1, 3, 1, 0] },
];

/** Heatmap franja × día, igual que "Turnos agendados" del dashboard:
 * `heatCell` sobre `HEAT_SCALE`, números siempre blancos, celdas cuadradas. */
function TurnosVista() {
  const max = Math.max(...FRANJAS.flatMap((f) => f.turnos));
  return (
    <div className={cn(GLASS_INNER, "p-4")}>
      <div className="grid grid-cols-[3.5rem_repeat(5,minmax(0,1fr))] gap-1">
        <span />
        {DIAS.map((d) => (
          <span key={d} className="text-center text-[10px] font-medium uppercase tracking-wide text-neutral-500">
            {d}
          </span>
        ))}
        {FRANJAS.map((f) => (
          <Fila key={f.label} label={f.label}>
            {f.turnos.map((n, i) => (
              <span
                key={i}
                className="flex aspect-square items-center justify-center rounded-md text-[11px] font-semibold tabular-nums text-white"
                style={{ background: heatCell(n, 0, max, HEAT_SCALE).bg }}
              >
                {n > 0 ? n : ""}
              </span>
            ))}
          </Fila>
        ))}
      </div>
    </div>
  );
}

function Fila({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <span className="self-center text-[11px] text-neutral-500">{label}</span>
      {children}
    </>
  );
}

const CONCILIACION: { caja: string; medio: MedioPagoVenta; sistema: number; contado: number }[] = [
  { caja: "Mostrador", medio: "pesos", sistema: 1250, contado: 1250 },
  { caja: "Caja USD", medio: "dolares", sistema: 980, contado: 960 },
  { caja: "Banco", medio: "transferencia", sistema: 640, contado: 640 },
];

/** Conciliación de cajas: tabla real (los estilos de `th`/cebra vienen del
 * global de la app), diferencia en rojo/verde como en `ConciliarDialog`. */
function CajasVista() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-900/[.06] bg-white">
      <table className="w-full text-xs sm:text-[13px]">
        <thead>
          <tr className="text-[10px]">
            <th className="px-1.5 py-2 sm:px-3">Caja</th>
            <th className="whitespace-nowrap px-1.5 py-2 text-right sm:px-3">Sistema</th>
            <th className="whitespace-nowrap px-1.5 py-2 text-right sm:px-3">Contado</th>
            <th className="whitespace-nowrap px-1.5 py-2 text-right sm:px-3">Dif.</th>
          </tr>
        </thead>
        <tbody>
          {CONCILIACION.map((c) => {
            const dif = c.contado - c.sistema;
            return (
              <tr key={c.caja}>
                <td className="px-1.5 py-2 sm:px-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={cn("h-1.5 w-1.5 rounded-full", dotClass[medioPago[c.medio].tone])} />
                    {c.caja}
                  </span>
                </td>
                <td className="whitespace-nowrap px-1.5 py-2 text-right tabular-nums sm:px-3">{fmtUsd(c.sistema)}</td>
                <td className="whitespace-nowrap px-1.5 py-2 text-right tabular-nums sm:px-3">{fmtUsd(c.contado)}</td>
                <td
                  className={cn(
                    "whitespace-nowrap px-1.5 py-2 text-right font-semibold tabular-nums sm:px-3",
                    dif === 0 ? "text-emerald-600" : "text-red-500",
                  )}
                >
                  {dif === 0 ? "OK" : `−${fmtUsd(Math.abs(dif))}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const MARGEN_MESES = [
  { mes: "may", pct: 26 },
  { mes: "jun", pct: 28 },
  { mes: "jul", pct: 27 },
  { mes: "ago", pct: 29 },
  { mes: "sep", pct: 30 },
  { mes: "oct", pct: 31 },
];

/** Barras verticales de la app (`rounded-t-xl`, ancladas a la base, la más
 * alta llena la banda) en versión tonal sobre la tarjeta accent. */
function AnaliticasVista() {
  const max = Math.max(...MARGEN_MESES.map((m) => m.pct));
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-white/25 bg-white/[.14] p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/80">
          Margen promedio · 6 meses
        </span>
        <span className="font-grotesk text-[22px] font-semibold tabular-nums">31%</span>
      </div>
      <div className="flex h-16 items-end gap-1.5" role="img" aria-label="Margen promedio mensual de mayo a octubre">
        {MARGEN_MESES.map((m, i) => (
          <span
            key={m.mes}
            className={cn("flex-1 rounded-t-xl", i === MARGEN_MESES.length - 1 ? "bg-white" : "bg-white/45")}
            style={{ height: `${(m.pct / max) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex gap-1.5">
        {MARGEN_MESES.map((m) => (
          <span key={m.mes} className="flex-1 text-center text-[10px] uppercase text-white/70">
            {m.mes}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Sección ───────────────────────────────────────────────────

const MODULOS: {
  titulo: string;
  detalle: string;
  vista: ReactNode;
  destacado?: boolean;
}[] = [
  {
    titulo: "Inventario",
    detalle: "Equipos por IMEI, repuestos y accesorios. Sabés qué hay, dónde y en qué estado.",
    vista: <InventarioVista />,
  },
  {
    titulo: "Ventas",
    detalle: "Pago dividido, canje como parte de pago y cuentas corrientes para tus clientes de siempre.",
    vista: <VentasVista />,
  },
  {
    titulo: "Reparaciones",
    detalle: "Tickets con checklist de ingreso y egreso. Se terminan los “así me lo trajeron”.",
    vista: <ReparacionesVista />,
  },
  {
    titulo: "Turnos",
    detalle: "Agenda semanal compartida: quién viene, a qué y quién lo atiende.",
    vista: <TurnosVista />,
  },
  {
    titulo: "Cajas",
    detalle: "Conciliación por caja. Al contar, sabés exactamente si falta o sobra algo.",
    vista: <CajasVista />,
  },
  {
    titulo: "Analíticas",
    detalle: "Márgenes, rotación de stock y rendimiento del equipo, sin armar una sola planilla.",
    vista: <AnaliticasVista />,
    destacado: true,
  },
];

export function MarketingModules() {
  return (
    <section id="modulos" className={`${SECTION_WRAP} flex scroll-mt-20 flex-col gap-14 pb-20 sm:pb-36`}>
      <SectionHeading
        eyebrow="Módulos"
        title="Un módulo para cada área. Un solo sistema."
        lead="Seis módulos que se hablan entre sí. Cada área trabaja en lo suyo y nadie pisa la información de otro."
      />

      <RevealStagger className="grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-2 xl:grid-cols-3">
        {MODULOS.map((m, i) => (
          <RevealItem key={m.titulo} className="h-full">
            <article
              className={cn(
                "flex h-full flex-col gap-[18px] rounded-3xl p-5 sm:p-[26px] transition-[transform,box-shadow] duration-200 hover:-translate-y-[3px]",
                m.destacado
                  ? "bg-accent text-white shadow-[0_20px_50px_-24px_rgb(var(--accent-rgb)/0.55)]"
                  : cn(GLASS, "hover:shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_0_0_1px_rgb(var(--accent-rgb)/0.12),0_30px_60px_-28px_rgba(30,27,75,.32)]"),
              )}
            >
              <div className="flex flex-col gap-1.5">
                <span className={cn("text-xs font-semibold tabular-nums", m.destacado ? "text-white/75" : "text-neutral-500")}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="font-display text-[26px] font-bold uppercase tracking-[-0.02em]">
                  {m.titulo}
                </h3>
                <p className={cn("text-sm leading-normal", m.destacado ? "text-white/85" : "text-neutral-600")}>
                  {m.detalle}
                </p>
              </div>
              <div className="mt-auto">{m.vista}</div>
            </article>
          </RevealItem>
        ))}
      </RevealStagger>
    </section>
  );
}
