"use client";

import { Button } from "@/components/ui/button";
import { useEffect, useState, useTransition } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ClipboardCheck,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs } from "@/components/ui/tabs";
import { SeccionTabla } from "@/components/ui/seccion-tabla";
import { BarraFiltros } from "@/components/ui/barra-filtros";
import {
  GraficoBarrasAgrupadas,
  GraficoBarrasVerticales,
  GraficoRanking,
} from "@/components/seccion/graficos";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  medioPago as medioPagoCfg,
  MEDIOS_CAJA,
  categoriaGasto as categoriaGastoCfg,
  CATEGORIAS_GASTO,
  dotClass,
} from "@/lib/status";
import { fmtUsd, fmtArs } from "@/lib/format";
import { useDolar } from "@/lib/dolar";
import {
  enArs,
  netoMovimientos,
  ingresosEgresosPorDia,
  saldoPorCaja,
  totalPorMoneda,
  resumenConciliaciones,
  diferenciaPorConciliacion,
  diferenciaPorCaja,
} from "@/lib/cajas";
import { useRealtime } from "@/components/notifications/realtime-provider";
import { cn } from "@/lib/utils";
import { filterPill, thDivider } from "@/lib/ui-styles";
import type {
  Caja,
  CategoriaGasto,
  Conciliacion,
  ConciliacionLinea,
  MedioPago,
  MovimientoCaja,
} from "@/lib/types";
import {
  saveCajaAction,
  createMovimientoAction,
  deleteMovimientoAction,
  crearConciliacionAction,
} from "./actions";
import type { CajaInput } from "@/lib/db/cajas";
import type { SessionUser } from "@/lib/auth/types";

const MEDIOS = MEDIOS_CAJA;

/** Tarjetas de arriba: todos los medios de caja menos "canje" (mercadería). */
const STAT_MEDIOS: MedioPago[] = MEDIOS.filter((m) => m !== "canje");

/** Tabs de sección -- `?tab=` en la URL para linkear directo (como Configuración). */
type Tab = "movimientos" | "conciliaciones" | "cajas";
const TABS: Tab[] = ["movimientos", "conciliaciones", "cajas"];

const HEAD = "text-[11px] font-semibold uppercase tracking-wider text-neutral-500";

const money = (moneda: "usd" | "ars", n: number) =>
  moneda === "usd" ? fmtUsd(n) : fmtArs(n);

const blankCaja: CajaInput = {
  nombre: "",
  moneda: "ars",
  activa: true,
  descripcion: "",
  medioPago: "pesos",
};

export function CajasClient({
  initialCajas,
  initialMovimientosSinConciliar,
  initialMovimientosTodos,
  initialConciliaciones,
  usuarioNombre,
  user,
}: {
  initialCajas: Caja[];
  initialMovimientosSinConciliar: MovimientoCaja[];
  initialMovimientosTodos: MovimientoCaja[];
  initialConciliaciones: Conciliacion[];
  usuarioNombre: string;
  user: SessionUser;
}) {
  const { publish } = useRealtime();
  const esAdmin = user.rol === "admin";
  const [, startDeleteTransition] = useTransition();
  const tabParam = useSearchParams().get("tab");
  const [tab, setTab] = useState<Tab>(
    tabParam && TABS.includes(tabParam as Tab) ? (tabParam as Tab) : "movimientos",
  );
  const [vista, setVista] = useState<"dia" | "historial">("dia");
  const [medioFiltro, setMedioFiltro] = useState<MedioPago | null>(null);
  const [cajaFiltro, setCajaFiltro] = useState<string | null>(null);
  const [q, setQ] = useState(useSearchParams().get("q") ?? "");
  const [openMov, setOpenMov] = useState<MovimientoCaja | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [cajas, setCajas] = useState<Caja[]>(initialCajas);
  const [editingCaja, setEditingCaja] = useState<{ id: string | null; data: CajaInput } | null>(
    null,
  );
  const [conciliarOpen, setConciliarOpen] = useState(false);
  const [movimientosHoy, setMovimientosHoy] = useState<MovimientoCaja[]>(
    initialMovimientosSinConciliar,
  );
  const [movimientosTodos, setMovimientosTodos] = useState<MovimientoCaja[]>(
    initialMovimientosTodos,
  );
  const [conciliaciones, setConciliaciones] = useState<Conciliacion[]>(initialConciliaciones);
  const RATE = useDolar().venta;
  const searchParams = useSearchParams();
  const router = useRouter();

  // ?accion=nuevo-movimiento-caja: el buscador global (CommandPalette) navega
  // acá con ese param. Efecto (no useState inicial) para que también funcione
  // estando ya parado en /cajas -- el componente no se remonta en la misma ruta.
  useEffect(() => {
    if (searchParams.get("accion") !== "nuevo-movimiento-caja") return;
    setNuevoOpen(true);
    router.replace("/cajas"); // limpia el param -- evita reabrir con back/refresh
  }, [searchParams, router]);

  // ?q= (búsqueda global): prefildea el filtro de movimientos. Efecto además
  // del useState inicial para que también funcione ya parado en /cajas (sin
  // remount). No se limpia el param: el filtro queda en la URL.
  useEffect(() => {
    const qParam = searchParams.get("q");
    if (qParam) setQ(qParam);
  }, [searchParams]);

  const cajaById = new Map(cajas.map((c) => [c.id, c]));
  const cajaDe = (m: MovimientoCaja) => cajaById.get(m.cajaId)!;

  const addMovimiento = (mov: MovimientoCaja) => {
    setMovimientosHoy((prev) => [mov, ...prev]);
    setMovimientosTodos((prev) => [mov, ...prev]);
  };

  function eliminarMovimiento(id: string) {
    const m = movimientosTodos.find((x) => x.id === id);
    setMovimientosHoy((prev) => prev.filter((m) => m.id !== id));
    setMovimientosTodos((prev) => prev.filter((m) => m.id !== id));
    setOpenMov(null);
    setConfirmDelete(false);
    startDeleteTransition(async () => {
      await deleteMovimientoAction(id);
    });
    if (m) {
      publish({
        type: "item_deleted",
        actor: user.nombre,
        entity: "Movimiento de caja",
        label: m.concepto,
      });
    }
  }

  const saveCajaLocal = (c: Caja) => {
    setCajas((prev) => (prev.some((x) => x.id === c.id) ? prev.map((x) => (x.id === c.id ? c : x)) : [...prev, c]));
    setEditingCaja(null);
  };

  // Neto de movimientos de una caja desde la última conciliación -- lógica
  // pura de lib/cajas.ts, no reimplementada acá.
  const montoSistemaDe = (cajaId: string) =>
    netoMovimientos(movimientosHoy.filter((m) => m.cajaId === cajaId));

  const confirmConciliacion = (conciliacion: Conciliacion) => {
    setConciliaciones((prev) => [conciliacion, ...prev]);
    setMovimientosHoy([]);
    setConciliarOpen(false);
  };

  // Por medio de pago -- consolidado en ARS. Las tarjetas de arriba funcionan
  // como filtro, igual que el pipeline de Reparaciones.
  const totalPorMedio = (medio: MedioPago) =>
    movimientosHoy
      .filter((x) => x.medioPago === medio)
      .reduce(
        (a, x) =>
          a + (x.tipo === "ingreso" ? 1 : -1) * enArs(x.monto, cajaDe(x).moneda, RATE),
        0,
      );

  const statMedios = STAT_MEDIOS.map((medio) => ({
    medio,
    total: totalPorMedio(medio),
  }));

  const query = q.trim().toLowerCase();
  const movs = (vista === "dia" ? movimientosHoy : movimientosTodos).filter(
    (m) =>
      (!medioFiltro || m.medioPago === medioFiltro) &&
      (!cajaFiltro || m.cajaId === cajaFiltro) &&
      (!query ||
        m.concepto.toLowerCase().includes(query) ||
        cajaDe(m).nombre.toLowerCase().includes(query) ||
        m.usuario.toLowerCase().includes(query) ||
        medioPagoCfg[m.medioPago].label.toLowerCase().includes(query)),
  );
  const hayFiltros = !!medioFiltro || !!cajaFiltro;

  // ── Datos de gráficos (lógica pura de lib/cajas.ts) ──
  const movsBase = vista === "dia" ? movimientosHoy : movimientosTodos;
  const dias = ingresosEgresosPorDia(movsBase, cajas);
  const saldosMovimiento = saldoPorCaja(movsBase, cajas);
  const saldosCaja = saldoPorCaja(movimientosTodos, cajas);
  const totales = totalPorMoneda(movimientosTodos, cajas);
  const resumenConc = resumenConciliaciones(conciliaciones, cajas);
  const difConc = diferenciaPorConciliacion(conciliaciones, cajas);
  const difCaja = diferenciaPorCaja(conciliaciones, cajas);
  const movimientosPorCaja = cajas.map((c) => ({
    label: c.nombre,
    value: movimientosTodos.filter((m) => m.cajaId === c.id).length,
  }));

  // "2026-09-07" -> "07/09" (slice, nunca `new Date`).
  const diaLabel = (iso: string) => {
    const [, mes, dia] = iso.split("-");
    return `${dia}/${mes}`;
  };
  // Ranking: el ancho usa el valor absoluto; el monto con signo y la moneda
  // de cada caja van en el `suffix`.
  const sufijoSaldo = (saldos: { nombre: string; moneda: "usd" | "ars"; saldo: number }[]) => {
    const meta = new Map(saldos.map((s) => [s.nombre, s]));
    return (r: { label: string }) => {
      const s = meta.get(r.label);
      return s ? money(s.moneda, s.saldo) : null;
    };
  };
  const difMeta = new Map(difCaja.map((d) => [d.nombre, d]));
  const sufijoDif = (r: { label: string }) => {
    const d = difMeta.get(r.label);
    if (!d) return null;
    return `${d.diff > 0 ? "+" : d.diff < 0 ? "−" : ""}${money(d.moneda, Math.abs(d.diff))}`;
  };

  const tabsEntidad = (
    <Tabs
      value={tab}
      onChange={setTab}
      className="w-full justify-between md:w-auto md:justify-start"
      options={[
        { value: "movimientos", label: "Movimientos" },
        { value: "conciliaciones", label: "Conciliaciones" },
        { value: "cajas", label: "Cajas" },
      ]}
    />
  );

  return (
    <div className="space-y-6">
      {tab === "movimientos" && (
        <SeccionTabla
          id="cajas-movimientos"
          columnasTarjetas={5}
          graficos={
            <>
              <GraficoBarrasAgrupadas
                title="Ingresos vs egresos por día"
                sub={
                  vista === "dia"
                    ? "Desde la última conciliación · en USD"
                    : "Historial · en USD"
                }
                labels={dias.map((d) => diaLabel(d.fecha))}
                series={[
                  { name: "Ingresos", values: dias.map((d) => d.ingresos) },
                  { name: "Egresos", values: dias.map((d) => d.egresos) },
                ]}
                fmt={fmtUsd}
                vacio="Sin movimientos convertibles en el período."
              />
              <GraficoRanking
                title="Saldo por caja"
                sub="Neto en la moneda de cada caja"
                rows={saldosMovimiento.map((s) => ({
                  label: s.nombre,
                  value: s.saldo,
                }))}
                fmt={() => ""}
                suffix={sufijoSaldo(saldosMovimiento)}
                vacio="Sin movimientos."
              />
            </>
          }
          tarjetas={statMedios.map(({ medio, total }) => (
            <StatCard
              key={medio}
              align="left"
              label={medioPagoCfg[medio].label}
              value={fmtArs(total)}
              hint={`≈ ${fmtUsd(total / RATE)}`}
              valueClassName={total < 0 ? "text-red-500" : undefined}
              active={medioFiltro === medio}
              onClick={() => setMedioFiltro(medioFiltro === medio ? null : medio)}
            />
          ))}
          filtros={
            <BarraFiltros
              tabs={tabsEntidad}
              contadorFiltros={
                (medioFiltro ? 1 : 0) + (cajaFiltro ? 1 : 0) + (q ? 1 : 0)
              }
              busqueda={
                <div className="relative w-full sm:w-52">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar movimientos…"
                    className={cn("w-full pl-9", filterPill)}
                    aria-label="Buscar movimientos"
                  />
                </div>
              }
              filtros={
                <>
                  <Tabs
                    value={vista}
                    onChange={setVista}
                    className="w-full justify-between sm:w-auto sm:justify-start"
                    options={[
                      { value: "dia", label: "Desde conciliación" },
                      { value: "historial", label: "Historial" },
                    ]}
                  />
                  <Select
                    value={cajaFiltro ?? ""}
                    onChange={(e) => setCajaFiltro(e.target.value || null)}
                    className={cn("w-full sm:w-44", filterPill)}
                    aria-label="Filtrar por caja"
                  >
                    <option value="">Todas las cajas</option>
                    {cajas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </Select>
                </>
              }
              accion={
                <Button icon={Plus}
                  onClick={() => setNuevoOpen(true)}
                  variant="tonal" fullOnMobile
                >
                  Nuevo movimiento
                </Button>
              }
            />
          }
        >
          <Card className="overflow-hidden">
            <div className="space-y-2 p-3 md:hidden">
              {movs.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setOpenMov(m)}
                  className="flex w-full items-center gap-2 rounded-xl border border-neutral-100 px-3 py-2 text-left transition-colors hover:bg-neutral-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm text-neutral-900">
                      {m.tipo === "ingreso" ? (
                        <ArrowDownLeft className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      ) : (
                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-red-400" />
                      )}
                      <span className="truncate">{m.concepto}</span>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-neutral-500">
                      {vista === "historial" ? `${m.fecha} · ` : ""}
                      {m.hora} · {cajaDe(m).nombre} · {medioPagoCfg[m.medioPago].label}
                      {m.categoria && ` · ${categoriaGastoCfg[m.categoria].label}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-end">
                    <p
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        m.tipo === "ingreso" ? "text-emerald-600" : "text-red-500",
                      )}
                    >
                      {m.tipo === "ingreso" ? "+" : "−"}
                      {money(cajaDe(m).moneda, m.monto)}
                    </p>
                    {cajaDe(m).moneda === "ars" && (
                      <p className="text-[11px] text-neutral-400">≈ {fmtUsd(m.monto / RATE)}</p>
                    )}
                  </div>
                </button>
              ))}
              {movs.length === 0 && (
                <p className="px-3 py-10 text-center text-sm text-neutral-400">
                  {query
                    ? "Sin movimientos que coincidan con la búsqueda."
                    : hayFiltros
                      ? "Sin movimientos para los filtros seleccionados."
                      : vista === "dia"
                        ? "Sin movimientos desde la última conciliación."
                        : "Sin movimientos en el historial."}
                </p>
              )}
            </div>

            <table className="mt-3 hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b border-neutral-100 text-xs text-neutral-400">
                  {vista === "historial" && (
                    <th className={cn("px-5 py-2 text-center", thDivider)}>Fecha</th>
                  )}
                  <th className={cn("px-5 py-2 text-center", thDivider)}>Hora</th>
                  <th className={cn("px-5 py-2 text-center", thDivider)}>Concepto</th>
                  <th className={cn("px-5 py-2 text-center", thDivider)}>Caja</th>
                  <th className={cn("px-5 py-2 text-center", thDivider)}>Moneda</th>
                  <th className={cn("px-5 py-2 text-center", thDivider)}>Medio</th>
                  <th className={cn("px-5 py-2 text-center", thDivider)}>Usuario</th>
                  <th className="px-5 py-2 text-center">Monto</th>
                </tr>
              </thead>
              <tbody>
                {movs.map((m) => (
                  <tr
                    key={m.id}
                    onClick={() => setOpenMov(m)}
                    className="cursor-pointer border-t border-neutral-100 first:border-t-0 hover:bg-neutral-50"
                  >
                    {vista === "historial" && (
                      <td className="px-5 py-2 text-center text-neutral-400">{m.fecha}</td>
                    )}
                    <td className="px-5 py-2 text-center text-neutral-400">{m.hora}</td>
                    <td className="max-w-[220px] px-5 py-2 text-start">
                      <span className="flex items-center gap-2">
                        {m.tipo === "ingreso" ? (
                          <ArrowDownLeft className="h-4 w-4 shrink-0 text-emerald-500" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4 shrink-0 text-red-400" />
                        )}
                        <span className="truncate">{m.concepto}</span>
                      </span>
                      {m.categoria && (
                        <span className="mt-0.5 inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500">
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              dotClass[categoriaGastoCfg[m.categoria].tone],
                            )}
                          />
                          {categoriaGastoCfg[m.categoria].label}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-2 text-center text-neutral-500">{cajaDe(m).nombre}</td>
                    <td className="px-5 py-2 text-center">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            cajaDe(m).moneda === "usd" ? dotClass.blue : dotClass.green,
                          )}
                        />
                        {cajaDe(m).moneda.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-2 text-center">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                        <span
                          className={cn("h-1.5 w-1.5 rounded-full", dotClass[medioPagoCfg[m.medioPago].tone])}
                        />
                        {medioPagoCfg[m.medioPago].label}
                      </span>
                    </td>
                    <td className="px-5 py-2 text-center text-neutral-500">{m.usuario}</td>
                    <td
                      className={cn(
                        "px-5 py-2 text-center tabular-nums",
                        m.tipo === "ingreso" ? "text-emerald-600" : "text-red-500",
                      )}
                    >
                      {m.tipo === "ingreso" ? "+" : "−"}
                      {money(cajaDe(m).moneda, m.monto)}
                      {cajaDe(m).moneda === "ars" && (
                        <span className="block text-[11px] font-normal text-neutral-400">
                          ≈ {fmtUsd(m.monto / RATE)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {movs.length === 0 && (
                  <tr>
                    <td
                      colSpan={vista === "historial" ? 8 : 7}
                      className="px-5 py-10 text-center text-sm text-neutral-400"
                    >
                      {query
                        ? "Sin movimientos que coincidan con la búsqueda."
                        : hayFiltros
                          ? "Sin movimientos para los filtros seleccionados."
                          : vista === "dia"
                            ? "Sin movimientos desde la última conciliación."
                            : "Sin movimientos en el historial."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </SeccionTabla>
      )}

      {tab === "conciliaciones" && (
        <SeccionTabla
          id="cajas-conciliaciones"
          graficos={
            <>
              <GraficoBarrasAgrupadas
                title="Diferencia por conciliación"
                sub="Cajas que sobraron vs. faltaron"
                labels={difConc.map((c) => c.label)}
                series={[
                  { name: "Sobrantes", values: difConc.map((c) => c.sobrantes) },
                  { name: "Faltantes", values: difConc.map((c) => c.faltantes) },
                ]}
                vacio="Sin conciliaciones registradas."
              />
              <GraficoRanking
                title="Diferencia por caja"
                sub="Acumulada, en la moneda de cada caja"
                rows={difCaja.map((d) => ({ label: d.nombre, value: d.diff }))}
                fmt={() => ""}
                suffix={sufijoDif}
                vacio="Ninguna caja con diferencias."
              />
            </>
          }
          tarjetas={
            <>
              <StatCard
                align="left"
                label="Conciliaciones"
                value={resumenConc.total}
              />
              <StatCard
                align="left"
                label="Con diferencia"
                value={resumenConc.conDiferencia}
                hint="alguna caja descuadrada"
              />
              <StatCard
                align="left"
                label="Diferencia acumulada"
                value={fmtArs(resumenConc.diferenciaArs)}
                hint={`USD ${fmtUsd(resumenConc.diferenciaUsd)}`}
              />
              <StatCard
                align="left"
                label="Última"
                value={resumenConc.ultima ? resumenConc.ultima.split(" · ")[0] : "—"}
                hint={resumenConc.ultima ?? "sin registrar"}
              />
            </>
          }
          filtros={
            <BarraFiltros
              tabs={tabsEntidad}
              accion={
                <Button icon={ClipboardCheck}
                  onClick={() => setConciliarOpen(true)}
                  variant="tonal" fullOnMobile
                >
                  Conciliar cajas
                </Button>
              }
            />
          }
        >
          <ConciliacionesTab conciliaciones={conciliaciones} cajas={cajas} />
        </SeccionTabla>
      )}

      {tab === "cajas" && (
        <SeccionTabla
          id="cajas-cajas"
          graficos={
            <>
              <GraficoRanking
                title="Saldo por caja"
                sub="Histórico, en la moneda de cada caja"
                rows={saldosCaja.map((s) => ({ label: s.nombre, value: s.saldo }))}
                fmt={() => ""}
                suffix={sufijoSaldo(saldosCaja)}
                vacio="Sin movimientos."
              />
              <GraficoBarrasVerticales
                title="Movimientos por caja"
                sub="Histórico"
                rows={movimientosPorCaja}
                vacio="Sin movimientos."
              />
            </>
          }
          tarjetas={
            <>
              <StatCard
                align="left"
                label="Cajas activas"
                value={cajas.filter((c) => c.activa).length}
                hint={`de ${cajas.length}`}
              />
              <StatCard align="left" label="Total ARS" value={fmtArs(totales.ars)} />
              <StatCard align="left" label="Total USD" value={fmtUsd(totales.usd)} />
              <StatCard
                align="left"
                label="Sin conciliar"
                value={movimientosHoy.length}
                hint="movimientos"
              />
            </>
          }
          filtros={
            <BarraFiltros
              tabs={tabsEntidad}
              accion={
                <Button icon={Plus}
                  onClick={() => setEditingCaja({ id: null, data: blankCaja })}
                  variant="tonal"
                  fullOnMobile
                >
                  Nueva caja
                </Button>
              }
            />
          }
        >
          <Card className="overflow-hidden">
            <div className="border-b border-neutral-100 px-5 py-3">
              <p className={HEAD}>
                {cajas.filter((c) => c.activa).length} de {cajas.length} activas
              </p>
            </div>

          <div className="space-y-2 p-3 md:hidden">
            {cajas.map((c) => (
              <Card key={c.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-900">{c.nombre}</p>
                    {c.descripcion && (
                      <p className="truncate text-xs text-neutral-500">{c.descripcion}</p>
                    )}
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                    <span
                      className={cn("h-1.5 w-1.5 rounded-full", c.activa ? dotClass.green : dotClass.gray)}
                    />
                    {c.activa ? "Activa" : "Inactiva"}
                  </span>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                    <span
                      className={cn("h-1.5 w-1.5 rounded-full", c.moneda === "usd" ? dotClass.blue : dotClass.green)}
                    />
                    {c.moneda.toUpperCase()}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                    <span
                      className={cn("h-1.5 w-1.5 rounded-full", dotClass[medioPagoCfg[c.medioPago].tone])}
                    />
                    {medioPagoCfg[c.medioPago].label}
                  </span>
                  <Button icon={Pencil}
                    onClick={() =>
                      setEditingCaja({
                        id: c.id,
                        data: {
                          nombre: c.nombre,
                          moneda: c.moneda,
                          activa: c.activa,
                          descripcion: c.descripcion,
                          medioPago: c.medioPago,
                        },
                      })
                    }
                    variant="tonal" size="sm"
                  >
                    Editar
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <table className="mt-3 hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b border-neutral-100 text-xs text-neutral-400">
                <th className={cn("px-5 py-2 text-center", thDivider)}>Creada</th>
                <th className={cn("px-5 py-2 text-center", thDivider)}>Caja</th>
                <th className={cn("px-5 py-2 text-center", thDivider)}>Descripción</th>
                <th className={cn("px-5 py-2 text-center", thDivider)}>Moneda</th>
                <th className={cn("px-5 py-2 text-center", thDivider)}>Medio</th>
                <th className={cn("px-5 py-2 text-center", thDivider)}>Estado</th>
                <th className="px-5 py-2 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cajas.map((c) => (
                <tr key={c.id} className="border-t border-neutral-100 first:border-t-0">
                  <td className="px-5 py-2.5 text-center text-neutral-500">{c.creadaEl}</td>
                  <td className="px-5 py-2.5 text-center font-medium">{c.nombre}</td>
                  <td
                    className={cn(
                      "max-w-[260px] truncate px-5 py-2.5 text-neutral-500",
                      c.descripcion ? "text-start" : "text-center",
                    )}
                  >
                    {c.descripcion || "—"}
                  </td>
                  <td className="px-5 py-2.5 text-center">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                      <span
                        className={cn("h-1.5 w-1.5 rounded-full", c.moneda === "usd" ? dotClass.blue : dotClass.green)}
                      />
                      {c.moneda.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-center">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                      <span
                        className={cn("h-1.5 w-1.5 rounded-full", dotClass[medioPagoCfg[c.medioPago].tone])}
                      />
                      {medioPagoCfg[c.medioPago].label}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-center">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                      <span
                        className={cn("h-1.5 w-1.5 rounded-full", c.activa ? dotClass.green : dotClass.gray)}
                      />
                      {c.activa ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td className="px-5 py-2.5">
                    <div className="flex items-center justify-center">
                      <Button icon={Pencil}
                        onClick={() =>
                          setEditingCaja({
                            id: c.id,
                            data: {
                              nombre: c.nombre,
                              moneda: c.moneda,
                              activa: c.activa,
                              descripcion: c.descripcion,
                              medioPago: c.medioPago,
                            },
                          })
                        }
                        variant="tonal" size="sm"
                      >
                        Editar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </Card>
        </SeccionTabla>
      )}

      <Dialog
        open={!!openMov}
        onClose={() => setOpenMov(null)}
        size="2xl"
        title={openMov?.concepto ?? ""}
        description={openMov ? `${openMov.fecha} · ${openMov.hora}` : ""}
        footer={
          openMov && (
            <>
              {esAdmin && openMov.conciliacionId && (
                <span className="mr-auto text-[11px] text-neutral-400">
                  Ya conciliado — no se puede eliminar.
                </span>
              )}
              {esAdmin && !openMov.conciliacionId && (
                <Button icon={Trash2}
                  onClick={() => setConfirmDelete(true)}
                  variant="danger-outline" fullOnMobile className="sm:mr-auto"
                >
                  Eliminar movimiento
                </Button>
              )}
              <Button
                onClick={() => setOpenMov(null)}
                variant="outline" fullOnMobile
              >
                Cerrar
              </Button>
            </>
          )
        }
      >
        {openMov && (
          <div>
            <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Información general
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Card className="p-2 text-center">
                <p className="font-grotesk truncate border-b border-neutral-300 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  Caja
                </p>
                <p className="mt-1.5 truncate text-sm font-normal text-neutral-600">{cajaDe(openMov).nombre}</p>
              </Card>
              <Card className="p-2 text-center">
                <p className="font-grotesk truncate border-b border-neutral-300 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  Moneda
                </p>
                <p className="mt-1.5 truncate text-sm font-normal text-neutral-600">
                  {cajaDe(openMov).moneda.toUpperCase()}
                </p>
              </Card>
              <Card className="p-2 text-center">
                <p className="font-grotesk truncate border-b border-neutral-300 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  Tipo
                </p>
                <p className="mt-1.5 truncate text-sm font-normal text-neutral-600">
                  {openMov.tipo === "ingreso" ? "Ingreso" : "Egreso"}
                </p>
              </Card>
              <Card className="p-2 text-center">
                <p className="font-grotesk truncate border-b border-neutral-300 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  Medio de pago
                </p>
                <p className="mt-1.5 truncate text-sm font-normal text-neutral-600">
                  {medioPagoCfg[openMov.medioPago].label}
                </p>
              </Card>
              {openMov.categoria && (
                <Card className="p-2 text-center">
                  <p className="font-grotesk truncate border-b border-neutral-300 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                    Categoría
                  </p>
                  <p className="mt-1.5 truncate text-sm font-normal text-neutral-600">
                    {categoriaGastoCfg[openMov.categoria].label}
                  </p>
                </Card>
              )}
              <Card className="p-2 text-center">
                <p className="font-grotesk truncate border-b border-neutral-300 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  Monto
                </p>
                <p
                  className={cn(
                    "mt-1.5 truncate text-sm tabular-nums",
                    openMov.tipo === "ingreso" ? "text-emerald-600" : "text-red-500",
                  )}
                >
                  {openMov.tipo === "ingreso" ? "+" : "−"}
                  {money(cajaDe(openMov).moneda, openMov.monto)}
                </p>
                {cajaDe(openMov).moneda === "ars" && (
                  <p className="text-[11px] text-neutral-400">≈ {fmtUsd(openMov.monto / RATE)}</p>
                )}
              </Card>
              <Card className="p-2 text-center">
                <p className="font-grotesk truncate border-b border-neutral-300 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  Usuario
                </p>
                <p className="mt-1.5 truncate text-sm font-normal text-neutral-600">{openMov.usuario}</p>
              </Card>
            </div>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => openMov && eliminarMovimiento(openMov.id)}
        title="¿Eliminar movimiento?"
        confirmLabel="Eliminar movimiento"
      >
        {openMov && `Se eliminará «${openMov.concepto}». Esta acción no se puede deshacer.`}
      </ConfirmDialog>

      <NuevoMovimientoDialog
        key={nuevoOpen ? "n" : "n0"}
        open={nuevoOpen}
        onClose={() => setNuevoOpen(false)}
        onCreate={addMovimiento}
        cajas={cajas.filter((c) => c.activa)}
        rate={RATE}
        usuarioNombre={usuarioNombre}
      />

      <CajaDialog
        key={editingCaja?.id ?? "new"}
        entry={editingCaja}
        onClose={() => setEditingCaja(null)}
        onSave={saveCajaLocal}
      />

      <ConciliarDialog
        key={conciliarOpen ? "c" : "c0"}
        open={conciliarOpen}
        onClose={() => setConciliarOpen(false)}
        cajas={cajas.filter((c) => c.activa)}
        montoSistemaDe={montoSistemaDe}
        onConfirm={confirmConciliacion}
      />
    </div>
  );
}

function NuevoMovimientoDialog({
  open,
  onClose,
  onCreate,
  cajas,
  rate,
  usuarioNombre,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (mov: MovimientoCaja) => void;
  cajas: Caja[];
  rate: number;
  usuarioNombre: string;
}) {
  const [tipo, setTipo] = useState<"ingreso" | "egreso">("ingreso");
  const [cajaId, setCajaId] = useState(cajas[0]?.id ?? "");
  const [concepto, setConcepto] = useState("");
  const [categoria, setCategoria] = useState<CategoriaGasto>(CATEGORIAS_GASTO[0]);
  const [monto, setMonto] = useState(0);
  const [pending, startTransition] = useTransition();

  const caja = cajas.find((c) => c.id === cajaId);
  const valid = !!concepto.trim() && monto > 0 && !!caja;

  const submit = () => {
    if (!caja) return;
    startTransition(async () => {
      const mov = await createMovimientoAction({
        tipo,
        cajaId,
        concepto: concepto.trim(),
        medioPago: caja.medioPago,
        categoria: tipo === "egreso" ? categoria : null,
        monto,
        // Operación nueva: se guarda el dólar vigente AHORA (snapshot).
        cotizacion: rate,
      });
      onCreate(mov);
      onClose();
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Nuevo movimiento"
      description="Se registra en la caja elegida y queda en el historial."
      footer={
        <>
          <Button
            onClick={onClose}
            variant="outline" fullOnMobile
          >
            Cancelar
          </Button>
          <Button
            disabled={!valid || pending}
            onClick={submit}
            variant="primary" fullOnMobile
          >
            {pending ? "Registrando…" : "Registrar movimiento"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <Field label="Tipo">
          <Select value={tipo} onChange={(e) => setTipo(e.target.value as "ingreso" | "egreso")}>
            <option value="ingreso">Ingreso</option>
            <option value="egreso">Egreso</option>
          </Select>
        </Field>
        <Field label="Caja">
          <Select
            value={cajaId}
            onChange={(e) => setCajaId(e.target.value)}
            disabled={cajas.length === 0}
          >
            {cajas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} · {c.moneda.toUpperCase()}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Concepto" className="sm:col-span-2">
          <Input
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            placeholder="Ej. Compra repuestos — PartsAR"
          />
        </Field>
        {tipo === "egreso" && (
          <Field label="Categoría">
            <Select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as CategoriaGasto)}
            >
              {CATEGORIAS_GASTO.map((c) => (
                <option key={c} value={c}>
                  {categoriaGastoCfg[c].label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field
          label={`Monto${caja ? ` (${caja.moneda.toUpperCase()})` : ""}`}
          className={tipo === "egreso" ? undefined : "sm:col-span-2"}
        >
          <Input
            type="number"
            min={0}
            value={monto || ""}
            onChange={(e) => setMonto(Number(e.target.value))}
            placeholder="0"
          />
        </Field>
        {cajas.length === 0 && (
          <p className="text-xs text-red-600 sm:col-span-2">
            Todavía no hay ninguna caja creada. Abrí «Cajas» al final de la página
            y creá una con «Nueva caja» antes de registrar un movimiento.
          </p>
        )}
        {/* Datos derivados de la caja y del monto, en una tira de vidrio */}
        {caja && (
          <div className="flex items-center justify-between gap-3 rounded-[14px] border border-white/80 bg-white/50 px-3.5 py-2.5 text-xs text-neutral-600 sm:col-span-2">
            <span>
              Medio de pago ·{" "}
              <strong className="font-semibold text-neutral-900">
                {medioPagoCfg[caja.medioPago].label}
              </strong>
            </span>
            {caja.moneda === "ars" && monto > 0 && (
              <span className="font-semibold tabular-nums text-accent">
                ≈ {fmtUsd(monto / rate)}
              </span>
            )}
          </div>
        )}
        <p className="text-[11px] text-neutral-500 sm:col-span-2">
          Se registra como <span className="font-medium text-neutral-700">{usuarioNombre}</span>.
        </p>
      </div>
    </Dialog>
  );
}

function CajaDialog({
  entry,
  onClose,
  onSave,
}: {
  entry: { id: string | null; data: CajaInput } | null;
  onClose: () => void;
  onSave: (c: Caja) => void;
}) {
  const [draft, setDraft] = useState<CajaInput>(entry?.data ?? blankCaja);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      const caja = await saveCajaAction(entry?.id ?? null, draft);
      onSave(caja);
    });
  };

  return (
    <Dialog
      open={!!entry}
      onClose={onClose}
      title={entry?.id ? "Editar caja" : "Nueva caja"}
      footer={
        <>
          <Button
            onClick={onClose}
            variant="outline" fullOnMobile
          >
            Cancelar
          </Button>
          <Button
            disabled={!draft.nombre.trim() || pending}
            onClick={submit}
            variant="primary" fullOnMobile
          >
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Nombre">
          <Input
            value={draft.nombre}
            onChange={(e) => setDraft({ ...draft, nombre: e.target.value })}
            placeholder="Mostrador"
          />
        </Field>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Field label="Moneda">
            <Select
              value={draft.moneda}
              onChange={(e) => setDraft({ ...draft, moneda: e.target.value as "usd" | "ars" })}
            >
              <option value="ars">Pesos (ARS)</option>
              <option value="usd">Dólares (USD)</option>
            </Select>
          </Field>
          <Field label="Medio de pago">
            <Select
              value={draft.medioPago}
              onChange={(e) => setDraft({ ...draft, medioPago: e.target.value as MedioPago })}
            >
              {MEDIOS.map((m) => (
                <option key={m} value={m}>
                  {medioPagoCfg[m].label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Descripción">
          <Textarea
            value={draft.descripcion}
            onChange={(e) => setDraft({ ...draft, descripcion: e.target.value })}
            placeholder="Para qué se usa esta caja"
            rows={2}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm text-neutral-600">
          <input
            type="checkbox"
            checked={draft.activa}
            onChange={(e) => setDraft({ ...draft, activa: e.target.checked })}
            className="h-4 w-4 rounded border-neutral-300 text-accent"
          />
          Caja activa (disponible para cargar movimientos)
        </label>
      </div>
    </Dialog>
  );
}

function ConciliarDialog({
  open,
  onClose,
  cajas,
  montoSistemaDe,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  cajas: Caja[];
  montoSistemaDe: (cajaId: string) => number;
  onConfirm: (conciliacion: Conciliacion) => void;
}) {
  const [reales, setReales] = useState<Record<string, string>>({});
  const [comentarios, setComentarios] = useState<Record<string, string>>({});
  const [comentarioGeneral, setComentarioGeneral] = useState("");
  const [pending, startTransition] = useTransition();

  const valid =
    cajas.length > 0 &&
    cajas.every((c) => {
      const v = reales[c.id];
      return v !== undefined && v.trim() !== "" && !Number.isNaN(Number(v));
    });

  const submit = () => {
    const lineas: ConciliacionLinea[] = cajas.map((c) => ({
      cajaId: c.id,
      montoSistema: montoSistemaDe(c.id),
      montoReal: Number(reales[c.id]),
      comentario: (comentarios[c.id] ?? "").trim(),
    }));
    startTransition(async () => {
      const conciliacion = await crearConciliacionAction(lineas, comentarioGeneral.trim());
      onConfirm(conciliacion);
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="2xl"
      title="Conciliar cajas"
      description="Contá cada caja y anotá el monto real — la diferencia con el sistema queda guardada."
      footer={
        <>
          <Button
            onClick={onClose}
            variant="outline" fullOnMobile
          >
            Cancelar
          </Button>
          <Button
            disabled={!valid || pending}
            onClick={submit}
            variant="primary" fullOnMobile
          >
            {pending ? "Confirmando…" : "Confirmar conciliación"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {cajas.length === 0 && (
          <p className="text-sm text-neutral-400">No hay cajas activas para conciliar.</p>
        )}
        {cajas.length > 0 && (
          <div className="space-y-2 md:hidden">
            {cajas.map((c) => {
              const sistema = montoSistemaDe(c.id);
              const realStr = reales[c.id] ?? "";
              const real = realStr.trim() === "" ? null : Number(realStr);
              const diff = real === null ? null : real - sistema;
              return (
                <Card key={c.id} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-neutral-900">
                      {c.nombre}{" "}
                      <span className="text-xs font-normal text-neutral-400">
                        {c.moneda.toUpperCase()}
                      </span>
                    </p>
                    <p
                      className={cn(
                        "shrink-0 text-sm font-semibold tabular-nums",
                        diff === null
                          ? "text-neutral-300"
                          : diff === 0
                            ? "text-emerald-600"
                            : "text-red-500",
                      )}
                    >
                      {diff === null ? "—" : `${diff > 0 ? "+" : ""}${money(c.moneda, diff)}`}
                    </p>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[11px] text-neutral-400">Sistema</p>
                      <p className="text-sm tabular-nums text-neutral-600">
                        {money(c.moneda, sistema)}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-[11px] text-neutral-400">Contado</p>
                      <Input
                        type="number"
                        min={0}
                        value={realStr}
                        onChange={(e) => setReales((p) => ({ ...p, [c.id]: e.target.value }))}
                        placeholder="0"
                        className="h-8 w-full text-center"
                      />
                    </div>
                  </div>
                  <Input
                    value={comentarios[c.id] ?? ""}
                    onChange={(e) => setComentarios((p) => ({ ...p, [c.id]: e.target.value }))}
                    placeholder="Notas sobre esta caja…"
                    className="mt-2 h-8"
                  />
                </Card>
              );
            })}
          </div>
        )}
        {cajas.length > 0 && (
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-xs text-neutral-400">
                  <th className={cn("px-5 py-2 text-center", thDivider)}>Caja</th>
                  <th className={cn("px-5 py-2 text-center", thDivider)}>Sistema</th>
                  <th className={cn("px-5 py-2 text-center", thDivider)}>Contado</th>
                  <th className={cn("px-5 py-2 text-center", thDivider)}>Diferencia</th>
                  <th className="px-5 py-2 text-center">Comentario</th>
                </tr>
              </thead>
              <tbody>
                {cajas.map((c) => {
                  const sistema = montoSistemaDe(c.id);
                  const realStr = reales[c.id] ?? "";
                  const real = realStr.trim() === "" ? null : Number(realStr);
                  const diff = real === null ? null : real - sistema;
                  return (
                    <tr key={c.id} className="border-t border-neutral-100 first:border-t-0">
                      <td className="px-5 py-2 text-center">
                        <span className="font-medium text-neutral-900">{c.nombre}</span>
                        <span className="ml-1.5 text-xs text-neutral-400">
                          {c.moneda.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-5 py-2 text-center tabular-nums text-neutral-500">
                        {money(c.moneda, sistema)}
                      </td>
                      <td className="px-5 py-2 text-center">
                        <Input
                          type="number"
                          min={0}
                          value={realStr}
                          onChange={(e) => setReales((p) => ({ ...p, [c.id]: e.target.value }))}
                          placeholder="0"
                          className="mx-auto h-8 w-28 text-center"
                        />
                      </td>
                      <td
                        className={cn(
                          "px-5 py-2 text-center font-semibold tabular-nums",
                          diff === null
                            ? "text-neutral-300"
                            : diff === 0
                              ? "text-emerald-600"
                              : "text-red-500",
                        )}
                      >
                        {diff === null ? "—" : `${diff > 0 ? "+" : ""}${money(c.moneda, diff)}`}
                      </td>
                      <td className="px-5 py-2">
                        <Input
                          value={comentarios[c.id] ?? ""}
                          onChange={(e) => setComentarios((p) => ({ ...p, [c.id]: e.target.value }))}
                          placeholder="Notas sobre esta caja…"
                          className="h-8"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
        <Field label="Comentario general (opcional)">
          <Textarea
            rows={2}
            value={comentarioGeneral}
            onChange={(e) => setComentarioGeneral(e.target.value)}
            placeholder="Notas generales de esta conciliación…"
          />
        </Field>
      </div>
    </Dialog>
  );
}

function ConciliacionesTab({
  conciliaciones,
  cajas,
}: {
  conciliaciones: Conciliacion[];
  cajas: Caja[];
}) {
  const cajaById = new Map(cajas.map((c) => [c.id, c]));

  if (conciliaciones.length === 0) {
    return (
      <Card className="p-10 text-center text-sm text-neutral-400">
        Todavía no se concilió ninguna caja.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {conciliaciones.map((c) => {
        const diffs = c.lineas.filter((l) => l.montoReal !== l.montoSistema);
        return (
          <Card key={c.id} className="overflow-hidden">
            <div className="flex flex-col gap-1 border-b border-neutral-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-neutral-900">
                  {c.fecha} · {c.hora}
                </p>
                <p className="text-xs text-neutral-400">{c.responsable}</p>
              </div>
              <span
                className={cn(
                  "text-xs font-medium",
                  diffs.length ? "text-red-500" : "text-emerald-600",
                )}
              >
                {diffs.length
                  ? `${diffs.length} ${diffs.length === 1 ? "caja con diferencia" : "cajas con diferencia"}`
                  : "Sin diferencias"}
              </span>
            </div>

            <div className="px-5 py-2 md:hidden">
              {c.lineas.map((l) => {
                const caja = cajaById.get(l.cajaId);
                const moneda = caja?.moneda ?? "ars";
                const diff = l.montoReal - l.montoSistema;
                return (
                  <div
                    key={l.cajaId}
                    className="flex items-center justify-between gap-2 border-b border-neutral-100 py-2 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-900">
                        {caja?.nombre ?? l.cajaId}
                        <span className="ml-1.5 text-xs font-normal text-neutral-400">
                          {moneda.toUpperCase()}
                        </span>
                      </p>
                      <p className="text-xs text-neutral-400">
                        Sistema {money(moneda, l.montoSistema)} · contado{" "}
                        {money(moneda, l.montoReal)}
                      </p>
                      {l.comentario && (
                        <p className="truncate text-xs italic text-neutral-400">{l.comentario}</p>
                      )}
                    </div>
                    <p
                      className={cn(
                        "shrink-0 text-sm font-semibold tabular-nums",
                        diff === 0 ? "text-emerald-600" : "text-red-500",
                      )}
                    >
                      {diff > 0 ? "+" : ""}
                      {money(moneda, diff)}
                    </p>
                  </div>
                );
              })}
            </div>

            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="text-xs">
                  <th className={cn("px-5 py-2", thDivider)}>Caja</th>
                  <th className={cn("px-5 py-2 text-end", thDivider)}>Sistema</th>
                  <th className={cn("px-5 py-2 text-end", thDivider)}>Contado</th>
                  <th className={cn("px-5 py-2 text-end", thDivider)}>Diferencia</th>
                  <th className="px-5 py-2">Comentario</th>
                </tr>
              </thead>
              <tbody>
                {c.lineas.map((l) => {
                  const caja = cajaById.get(l.cajaId);
                  const moneda = caja?.moneda ?? "ars";
                  const diff = l.montoReal - l.montoSistema;
                  return (
                    <tr key={l.cajaId} className="border-t border-neutral-100 first:border-t-0">
                      <td className="px-5 py-2">
                        <span className="font-medium text-neutral-900">{caja?.nombre ?? l.cajaId}</span>
                        <span className="ml-1.5 text-xs text-neutral-400">{moneda.toUpperCase()}</span>
                      </td>
                      <td className="px-5 py-2 text-end tabular-nums text-neutral-500">
                        {money(moneda, l.montoSistema)}
                      </td>
                      <td className="px-5 py-2 text-end tabular-nums">
                        {money(moneda, l.montoReal)}
                      </td>
                      <td
                        className={cn(
                          "px-5 py-2 text-end font-semibold tabular-nums",
                          diff === 0 ? "text-emerald-600" : "text-red-500",
                        )}
                      >
                        {diff > 0 ? "+" : ""}
                        {money(moneda, diff)}
                      </td>
                      <td className="max-w-[260px] truncate px-5 py-2 text-neutral-500">
                        {l.comentario || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {c.comentario && (
              <p className="border-t border-neutral-100 px-5 py-3 text-xs italic text-neutral-500">
                {c.comentario}
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
