"use client";

import { useState } from "react";
import { Section } from "@/components/section";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChartTitle } from "@/components/ui/chart-title";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs } from "@/components/ui/tabs";
import { Input, Select } from "@/components/ui/field";
import { DATE_PRESETS, presetRange, type DatePreset } from "@/lib/date-presets";
import { filterPill } from "@/lib/ui-styles";
// Estos 2 datasets no son derivables de las tablas reales todavía: no hay
// timestamp de "listo/entregado" en tickets (tiempoPorFalla), ni campo de
// reingreso/calificación en ningún lado (rendimientoTecnicos). Agregar esas
// columnas es una decisión de producto, no de esta migración.
import { tiempoPorFalla, rendimientoTecnicos } from "@/lib/mock-data";
import {
  margenPorTipo as calcularMargenPorTipo,
  ventasPorDiaSemana,
  type MargenPorTipo,
  type RubroMes,
} from "@/lib/analiticas";
import { RUBRO_LABEL, RUBRO_ORDEN, categoriaDe } from "@/lib/ventas";
import {
  equipoStatus,
  medioPago as medioPagoCfg,
  turnoTipo,
  turnoStatus,
} from "@/lib/status";
import { fmtUsd } from "@/lib/format";
import { useDolar } from "@/lib/dolar";
import { CHART_ACCENT, chartColor } from "@/lib/chart";
import { cn } from "@/lib/utils";
import { TendenciaRubros } from "@/components/analiticas/tendencia-rubros";
import { DonutChart } from "@/components/dashboard/donut-chart";
import { DemografiaClientes } from "@/components/clientes/demografia";
import { InventarioValor } from "@/components/inventario-valor";
import type { Caja, Cliente, Equipo, MovimientoCaja, OtroItem, Repuesto, Turno, Venta } from "@/lib/types";
import type { Periodo, RangoEdad } from "@/lib/clientes";

type Row = { label: string; value: number };

function BarRows({ rows, fmt }: { rows: Row[]; fmt?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="mt-4 space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-neutral-600">{r.label}</span>
            <span className="font-semibold tabular-nums">
              {fmt ? fmt(r.value) : r.value}
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-neutral-100">
            <div
              className="h-2 rounded-full bg-accent"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function agrupar(pares: [string, number][]): Row[] {
  return pares
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

const CATEGORIAS = [
  { value: "ventas", label: "Ventas" },
  { value: "reparaciones", label: "Reparaciones" },
  { value: "finanzas", label: "Finanzas" },
  { value: "inventario", label: "Inventario" },
  { value: "clientes", label: "Clientes" },
  { value: "turnos", label: "Turnos" },
] as const;
type Categoria = (typeof CATEGORIAS)[number]["value"];

export function AnaliticasClient({
  ventas,
  equipos,
  repuestos,
  otros,
  clientes,
  turnos,
  cajas,
  movimientosTodos,
  ventasPorMes,
  salesTrend,
  margenPorTipo,
  rubroMesData,
  demografia,
  fuenteClientes,
}: {
  ventas: Venta[];
  equipos: Equipo[];
  repuestos: Repuesto[];
  otros: OtroItem[];
  clientes: Cliente[];
  turnos: Turno[];
  cajas: Caja[];
  movimientosTodos: MovimientoCaja[];
  ventasPorMes: { mes: string; usd: number }[];
  salesTrend: number[];
  margenPorTipo: MargenPorTipo[];
  rubroMesData: RubroMes[];
  demografia: Record<Periodo, RangoEdad[]>;
  fuenteClientes: React.ReactNode;
}) {
  const [tab, setTab] = useState<Categoria>("ventas");
  const dolarVenta = useDolar().venta;

  const [datePreset, setDatePreset] = useState<DatePreset>("todos");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const range =
    datePreset === "personalizado"
      ? { desde, hasta }
      : (presetRange(datePreset) ?? { desde: "", hasta: "" });
  const inRange = (iso: string) =>
    (!range.desde || iso >= range.desde) && (!range.hasta || iso <= range.hasta);

  // Solo se filtran por fecha los gráficos que salen de registros con fecha
  // propia (ventas, movimientos de caja). Los demás son fotos del estado
  // actual (stock, valor de inventario) o series ya fijas por período
  // (tendencias mensuales, demografía, turnos de los próximos 7 días) — no
  // hay una fecha real detrás para filtrarlos.
  const ventasFiltradas = ventas.filter((v) => inRange(v.fechaISO));
  const movimientosFiltrados = movimientosTodos.filter((m) =>
    inRange(new Date(m.fecha).toISOString().slice(0, 10)),
  );

  const maxMes = Math.max(1, ...ventasPorMes.map((m) => m.usd));
  const maxHoras = Math.max(1, ...tiempoPorFalla.map((f) => f.horas));

  const porMedio = agrupar(
    Object.entries(
      ventasFiltradas
        .flatMap((v) => v.pagos)
        .reduce<Record<string, number>>((a, p) => {
          a[p.medio] = (a[p.medio] ?? 0) + p.montoUsd;
          return a;
        }, {}),
    ),
  ).map((r) => ({
    ...r,
    label: medioPagoCfg[r.label as keyof typeof medioPagoCfg].label,
  }));

  const porCanal = agrupar(
    Object.entries(
      ventasFiltradas.reduce<Record<string, number>>((a, v) => {
        const c = v.procedencia ?? "Sin dato";
        a[c] = (a[c] ?? 0) + v.totalUsd;
        return a;
      }, {}),
    ),
  );

  // ── Ventas: KPIs del período filtrado ──
  const facturacionPeriodo = ventasFiltradas.reduce((a, v) => a + v.totalUsd, 0);
  const cantidadOperaciones = ventasFiltradas.length;
  const ticketPromedio = cantidadOperaciones > 0 ? facturacionPeriodo / cantidadOperaciones : 0;
  const margenPromedio =
    facturacionPeriodo > 0
      ? ventasFiltradas.reduce((a, v) => a + v.margenPct * v.totalUsd, 0) / facturacionPeriodo
      : 0;

  // ── Ventas: ítems más vendidos del período (por ingreso) ──
  const itemsVendidos: Row[] = (() => {
    const acc = new Map<string, number>();
    for (const v of ventasFiltradas) {
      for (const item of v.items) {
        acc.set(item.detalle, (acc.get(item.detalle) ?? 0) + item.precioUsd * item.cantidad);
      }
    }
    return agrupar([...acc.entries()]).slice(0, 6);
  })();

  // ── Ventas: mix de rubros del período (dona) ──
  const rubroSlices = (() => {
    const totales = new Map<string, number>();
    for (const v of ventasFiltradas) {
      for (const item of v.items) {
        const cat = categoriaDe(item);
        totales.set(cat, (totales.get(cat) ?? 0) + item.precioUsd * item.cantidad);
      }
    }
    const datos = RUBRO_ORDEN.map((cat) => ({ label: RUBRO_LABEL[cat], value: totales.get(cat) ?? 0 }));
    const total = datos.reduce((a, d) => a + d.value, 0) || 1;
    return datos.map((d, i) => ({
      label: d.label,
      pct: Math.round((d.value / total) * 100),
      color: chartColor(i),
      valueLabel: fmtUsd(d.value),
    }));
  })();

  // ── Ventas: ganancia por categoría del período (mismo cálculo que la
  // tabla de Finanzas, `margenPorTipo`, pero sobre `ventasFiltradas`) ──
  const gananciaPeriodo: Row[] = calcularMargenPorTipo(ventasFiltradas)
    .map((r) => ({ label: r.tipo, value: r.gananciaUsd }))
    .sort((a, b) => b.value - a.value);

  // ── Ventas: facturación por vendedor (dona con % y monto) ──
  const porVendedor = agrupar(
    Object.entries(
      ventasFiltradas.reduce<Record<string, number>>((a, v) => {
        a[v.vendedor] = (a[v.vendedor] ?? 0) + v.totalUsd;
        return a;
      }, {}),
    ),
  );
  const totalVendedores = porVendedor.reduce((a, r) => a + r.value, 0) || 1;
  const vendedorSlices = porVendedor.map((r, i) => ({
    label: r.label,
    pct: Math.round((r.value / totalVendedores) * 100),
    color: chartColor(i),
    valueLabel: fmtUsd(r.value),
  }));

  // ── Ventas: distribución por día de la semana ──
  const porDiaSemana = ventasPorDiaSemana(ventasFiltradas);
  const maxDiaSemana = Math.max(1, ...porDiaSemana.map((d) => d.usd));

  const equiposPorEstado = (
    Object.keys(equipoStatus) as (keyof typeof equipoStatus)[]
  ).map((s) => ({
    label: equipoStatus[s].label,
    value: equipos.filter((e) => e.estado === s).length,
  }));

  // facturación acumulada (14 días)
  const W = 640;
  const H = 160;
  let acc = 0;
  const acum = salesTrend.map((d) => (acc += d));
  const maxAcum = acum[acum.length - 1] || 1;
  const pts = acum.map((v, i) => {
    const x = (i / Math.max(1, acum.length - 1)) * W;
    const y = H - (v / maxAcum) * (H - 12);
    return `${x},${y}`;
  });
  const line = `M${pts.join(" L")}`;
  const area = `${line} L${W},${H} L0,${H} Z`;

  // ── Finanzas: ingresos vs egresos de Cajas, todo convertido a USD ──
  const cajaById = new Map(cajas.map((c) => [c.id, c]));
  const enUsd = (m: MovimientoCaja) => {
    const caja = cajaById.get(m.cajaId);
    if (!caja) return 0;
    return caja.moneda === "usd" ? m.monto : m.monto / dolarVenta;
  };
  const ingresosUsd = movimientosFiltrados
    .filter((m) => m.tipo === "ingreso")
    .reduce((a, m) => a + enUsd(m), 0);
  const egresosUsd = movimientosFiltrados
    .filter((m) => m.tipo === "egreso")
    .reduce((a, m) => a + enUsd(m), 0);
  const netoUsd = ingresosUsd - egresosUsd;

  // ── Clientes ──
  const topClientes: Row[] = [...clientes]
    .sort((a, b) => b.gastadoUsd - a.gastadoUsd)
    .slice(0, 6)
    .map((c) => ({ label: c.nombre, value: c.gastadoUsd }));

  const clientesPorAnio = agrupar(
    Object.entries(
      clientes.reduce<Record<string, number>>((a, c) => {
        const anio = c.desde.split(" ")[1];
        a[anio] = (a[anio] ?? 0) + 1;
        return a;
      }, {}),
    ),
  ).sort((a, b) => a.label.localeCompare(b.label));

  // ── Turnos ──
  const turnosPorTipo: Row[] = (
    Object.keys(turnoTipo) as (keyof typeof turnoTipo)[]
  ).map((t) => ({
    label: turnoTipo[t].label,
    value: turnos.filter((x) => x.tipo === t).length,
  }));

  const turnosPorEstado: Row[] = (
    Object.keys(turnoStatus) as (keyof typeof turnoStatus)[]
  ).map((e) => ({
    label: turnoStatus[e].label,
    value: turnos.filter((x) => x.estado === e).length,
  }));

  const turnosPorHora: Row[] = Array.from({ length: 12 }, (_, i) => {
    const h = `${String(i + 9).padStart(2, "0")}:00`;
    return { label: h, value: turnos.filter((t) => t.hora === h).length };
  });
  const maxPorHora = Math.max(1, ...turnosPorHora.map((x) => x.value));

  return (
    <Section
      title="Analíticas"
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value as DatePreset)}
            className={cn("w-44", filterPill)}
          >
            {DATE_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
          {datePreset === "personalizado" && (
            <>
              <Input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className={cn("w-36", filterPill)}
              />
              <span className="text-xs text-neutral-400">a</span>
              <Input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className={cn("w-36", filterPill)}
              />
            </>
          )}
          {datePreset !== "todos" && (
            <button
              onClick={() => {
                setDatePreset("todos");
                setDesde("");
                setHasta("");
              }}
              className="text-xs text-neutral-400 hover:text-neutral-600"
            >
              limpiar fecha
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        <Tabs
          value={tab}
          onChange={setTab}
          options={CATEGORIAS.map((c) => ({ value: c.value, label: c.label }))}
        />

        {tab === "ventas" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard label="Facturación" value={fmtUsd(facturacionPeriodo)} />
              <StatCard label="Ticket promedio" value={fmtUsd(Math.round(ticketPromedio))} />
              <StatCard label="Operaciones" value={cantidadOperaciones} />
              <StatCard label="Margen promedio" value={`${margenPromedio.toFixed(1)}%`} />
            </div>

            <TendenciaRubros data={rubroMesData} className="min-h-[340px]" />

            <div className="grid gap-6 xl:grid-cols-2">
              <Card className="p-5">
                <ChartTitle align="left" divider>Ventas por mes (U$)</ChartTitle>
                <div className="mt-5 flex items-end gap-3">
                  {ventasPorMes.map((m) => (
                    <div key={m.mes} className="flex flex-1 flex-col items-center gap-2">
                      <span className="text-[11px] font-medium text-neutral-400">
                        {(m.usd / 1000).toFixed(0)}k
                      </span>
                      <div
                        className="w-full rounded-t-xl bg-accent"
                        style={{ height: `${(m.usd / maxMes) * 140}px` }}
                      />
                      <span className="text-xs text-neutral-500">{m.mes}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-5">
                <ChartTitle align="left" divider>Facturación por vendedor</ChartTitle>
                <div className="mt-3 border-t border-neutral-100 pt-3">
                  <DonutChart slices={vendedorSlices} />
                </div>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card className="p-5">
                <ChartTitle align="left" divider>Ventas por canal</ChartTitle>
                <BarRows rows={porCanal} fmt={fmtUsd} />
              </Card>
              <Card className="p-5">
                <ChartTitle align="left" divider>Ingresos por medio de pago</ChartTitle>
                <BarRows rows={porMedio} fmt={fmtUsd} />
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card className="p-5">
                <ChartTitle align="left" divider>Ítems más vendidos</ChartTitle>
                <BarRows rows={itemsVendidos} fmt={fmtUsd} />
              </Card>
              <Card className="p-5">
                <ChartTitle align="left" divider sub="del período filtrado">Mix de rubros</ChartTitle>
                <div className="mt-3 border-t border-neutral-100 pt-3">
                  <DonutChart slices={rubroSlices} />
                </div>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card className="p-5">
                <ChartTitle align="left" divider>Ganancia por categoría</ChartTitle>
                <BarRows rows={gananciaPeriodo} fmt={fmtUsd} />
              </Card>
              <Card className="p-5">
                <ChartTitle align="left" divider>Ventas por día de la semana</ChartTitle>
                <div className="mt-5 flex items-end gap-3">
                  {porDiaSemana.map((d) => (
                    <div key={d.dia} className="flex flex-1 flex-col items-center gap-2">
                      <span className="text-[11px] font-medium text-neutral-400">
                        {d.usd > 0 ? fmtUsd(d.usd) : ""}
                      </span>
                      <div
                        className="w-full rounded-t-xl bg-accent"
                        style={{ height: `${Math.max(4, (d.usd / maxDiaSemana) * 140)}px` }}
                      />
                      <span className="text-xs text-neutral-500">{d.dia}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <Card className="p-5">
              <ChartTitle align="left" divider sub="últimos 14 días">Facturación acumulada</ChartTitle>
              <div className="mt-4 flex items-end justify-between">
                <span className="text-2xl font-semibold tabular-nums">{fmtUsd(maxAcum)}</span>
              </div>
              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-3 h-40 w-full">
                <defs>
                  <linearGradient id="acumFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_ACCENT} stopOpacity="0.18" />
                    <stop offset="100%" stopColor={CHART_ACCENT} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={area} fill="url(#acumFill)" />
                <path
                  d={line}
                  fill="none"
                  stroke={CHART_ACCENT}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </Card>
          </div>
        )}

        {tab === "reparaciones" && (
          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="p-5">
              <ChartTitle align="left" divider>Tiempo promedio por tipo de falla</ChartTitle>
              <ul className="mt-4 space-y-3">
                {tiempoPorFalla.map((f) => (
                  <li key={f.falla}>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-neutral-600">{f.falla}</span>
                      <span className="font-semibold">
                        {f.horas} h
                        <span className="ml-1 text-xs font-normal text-neutral-400">
                          · {f.tickets} tickets
                        </span>
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-neutral-100">
                      <div
                        className="h-2 rounded-full bg-accent"
                        style={{ width: `${(f.horas / maxHoras) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-5">
              <ChartTitle align="left" divider>Rendimiento por técnico</ChartTitle>
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="text-xs text-neutral-400">
                    <th className="py-2 font-medium">Técnico</th>
                    <th className="py-2 font-medium">Cerrados</th>
                    <th className="py-2 font-medium">Reingresos</th>
                    <th className="py-2 font-medium">Prom.</th>
                    <th className="py-2 font-medium">Calif.</th>
                  </tr>
                </thead>
                <tbody>
                  {rendimientoTecnicos.map((t) => (
                    <tr key={t.tecnico} className="border-t border-neutral-100">
                      <td className="py-2.5 font-medium">{t.tecnico}</td>
                      <td className="py-2.5">{t.cerrados}</td>
                      <td className="py-2.5 text-neutral-500">{t.reingresos}</td>
                      <td className="py-2.5 text-neutral-500">{t.ticketPromHoras} h</td>
                      <td className="py-2.5 font-semibold">{t.calif} ★</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {tab === "finanzas" && (
          <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-2">
              <Card className="p-5">
                <ChartTitle align="left" divider>Margen por tipo de operación</ChartTitle>
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr className="text-xs text-neutral-400">
                      <th className="py-2 font-medium">Tipo</th>
                      <th className="py-2 font-medium">Ops.</th>
                      <th className="py-2 font-medium">Margen</th>
                      <th className="py-2 font-medium">Ganancia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {margenPorTipo.map((r) => (
                      <tr key={r.tipo} className="border-t border-neutral-100">
                        <td className="py-2.5">{r.tipo}</td>
                        <td className="py-2.5 text-neutral-500">{r.operaciones}</td>
                        <td className="py-2.5">
                          <Badge tone={r.margenPct > 35 ? "green" : "blue"}>
                            {r.margenPct.toFixed(1)}%
                          </Badge>
                        </td>
                        <td className="py-2.5 font-semibold">{fmtUsd(r.gananciaUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              <Card className="p-5">
                <ChartTitle align="left" divider>Ingresos por medio de pago</ChartTitle>
                <BarRows rows={porMedio} fmt={fmtUsd} />
              </Card>
            </div>

            <Card className="p-5">
              <ChartTitle align="left" divider sub="todo el historial de movimientos, convertido a USD">
                Ingresos vs egresos (Cajas)
              </ChartTitle>
              <div className="mt-4 space-y-3">
                {[
                  { label: "Ingresos", value: ingresosUsd, color: "bg-emerald-500" },
                  { label: "Egresos", value: egresosUsd, color: "bg-red-400" },
                ].map((r) => (
                  <div key={r.label}>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-neutral-600">{r.label}</span>
                      <span className="font-semibold tabular-nums">{fmtUsd(r.value)}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-neutral-100">
                      <div
                        className={cn("h-2 rounded-full", r.color)}
                        style={{
                          width: `${(r.value / Math.max(ingresosUsd, egresosUsd, 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[13px] text-neutral-500">
                Neto:{" "}
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    netoUsd >= 0 ? "text-emerald-600" : "text-red-500",
                  )}
                >
                  {fmtUsd(netoUsd)}
                </span>
              </p>
            </Card>
          </div>
        )}

        {tab === "inventario" && (
          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="p-5">
              <ChartTitle align="left" divider>Inventario · equipos por estado</ChartTitle>
              <BarRows rows={equiposPorEstado} />
            </Card>
            <InventarioValor equipos={equipos} repuestos={repuestos} otros={otros} />
          </div>
        )}

        {tab === "clientes" && (
          <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-2">
              <DemografiaClientes data={demografia} />
              {fuenteClientes}
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <Card className="p-5">
                <ChartTitle align="left" divider>Top clientes por gasto</ChartTitle>
                <BarRows rows={topClientes} fmt={fmtUsd} />
              </Card>
              <Card className="p-5">
                <ChartTitle align="left" divider>Clientes nuevos por año</ChartTitle>
                <BarRows rows={clientesPorAnio} />
              </Card>
            </div>
          </div>
        )}

        {tab === "turnos" && (
          <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-2">
              <Card className="p-5">
                <ChartTitle align="left" divider>Turnos por tipo</ChartTitle>
                <BarRows rows={turnosPorTipo} />
              </Card>
              <Card className="p-5">
                <ChartTitle align="left" divider>Asistencia vs cancelación</ChartTitle>
                <BarRows rows={turnosPorEstado} />
              </Card>
            </div>
            <Card className="p-5">
              <ChartTitle align="left" divider sub="09 a 20 h, próximos 7 días">
                Ocupación por franja horaria
              </ChartTitle>
              <div className="mt-5 flex items-end gap-2">
                {turnosPorHora.map((h) => (
                  <div key={h.label} className="flex flex-1 flex-col items-center gap-2">
                    <span className="text-[11px] font-medium text-neutral-400">{h.value || ""}</span>
                    <div
                      className="w-full rounded-t-xl bg-accent"
                      style={{ height: `${Math.max(4, (h.value / maxPorHora) * 100)}px` }}
                    />
                    <span className="text-[10px] text-neutral-500">{h.label}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </Section>
  );
}
