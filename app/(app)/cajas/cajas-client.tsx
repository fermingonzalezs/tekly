"use client";

import { useState, useTransition } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs } from "@/components/ui/tabs";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { medioPago as medioPagoCfg, MEDIOS_CAJA, dotClass } from "@/lib/status";
import { fmtUsd, fmtArs } from "@/lib/format";
import { useDolar } from "@/lib/dolar";
import { enArs, netoMovimientos, signo } from "@/lib/cajas";
import { useRealtime } from "@/components/notifications/realtime-provider";
import { cn } from "@/lib/utils";
import { filterPill, thDivider } from "@/lib/ui-styles";
import type {
  Caja,
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

const STAT_MEDIOS: MedioPago[] = ["transferencia", "pesos", "tarjeta", "canje"];

const HEAD = "text-[11px] font-semibold uppercase tracking-wider text-neutral-400";

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
  const [vista, setVista] = useState<"dia" | "historial">("dia");
  const [medioFiltro, setMedioFiltro] = useState<MedioPago | null>(null);
  const [q, setQ] = useState("");
  const [openMov, setOpenMov] = useState<MovimientoCaja | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [cajas, setCajas] = useState<Caja[]>(initialCajas);
  const [editingCaja, setEditingCaja] = useState<{ id: string | null; data: CajaInput } | null>(
    null,
  );
  const [cajasOpen, setCajasOpen] = useState(true);
  const [conciliarOpen, setConciliarOpen] = useState(false);
  const [movimientosHoy, setMovimientosHoy] = useState<MovimientoCaja[]>(
    initialMovimientosSinConciliar,
  );
  const [movimientosTodos, setMovimientosTodos] = useState<MovimientoCaja[]>(
    initialMovimientosTodos,
  );
  const [conciliaciones, setConciliaciones] = useState<Conciliacion[]>(initialConciliaciones);
  const RATE = useDolar().venta;

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

  const netoUsd = movimientosHoy
    .filter((m) => cajaDe(m).moneda === "usd")
    .reduce((a, m) => a + signo(m), 0);
  const netoArs = movimientosHoy
    .filter((m) => cajaDe(m).moneda === "ars")
    .reduce((a, m) => a + signo(m), 0);
  const totalArs = netoArs + netoUsd * RATE;

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

  const porMedio = MEDIOS.map((medio) => ({
    medio,
    total: totalPorMedio(medio),
  })).filter((p) => p.total !== 0);

  const query = q.trim().toLowerCase();
  const movs = (vista === "dia" ? movimientosHoy : movimientosTodos).filter(
    (m) =>
      (!medioFiltro || m.medioPago === medioFiltro) &&
      (!query ||
        m.concepto.toLowerCase().includes(query) ||
        cajaDe(m).nombre.toLowerCase().includes(query) ||
        m.usuario.toLowerCase().includes(query) ||
        medioPagoCfg[m.medioPago].label.toLowerCase().includes(query)),
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {statMedios.map(({ medio, total }) => (
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
        <StatCard
          className="col-span-2 lg:col-span-1"
          align="left"
          label="Total (ARS)"
          value={fmtArs(totalArs)}
          hint={`≈ ${fmtUsd(totalArs / RATE)} · dólar ${fmtArs(RATE)}`}
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por concepto, caja, usuario o medio…"
            className={cn("w-full pl-9", filterPill)}
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 md:ml-auto">
          <button
            onClick={() => setNuevoOpen(true)}
            className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-accent/40 px-4 text-sm font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Nuevo movimiento
          </button>
          <button
            onClick={() => setConciliarOpen(true)}
            className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-accent/40 px-4 text-sm font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft sm:w-auto"
          >
            <ClipboardCheck className="h-4 w-4" />
            Conciliar cajas
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className={HEAD}>
          {vista === "dia" ? "Movimientos desde la conciliación" : "Historial de movimientos"}
        </p>
        <Tabs
          value={vista}
          onChange={setVista}
          className="w-full justify-between sm:w-auto sm:justify-start"
          options={[
            { value: "dia", label: "Desde conciliación" },
            { value: "historial", label: "Historial" },
          ]}
        />
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[1fr_320px]">
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
                  : "Sin movimientos para este medio de pago."}
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
                  <td className="max-w-[220px] truncate px-5 py-2 text-start">
                    <span className="inline-flex items-center gap-2">
                      {m.tipo === "ingreso" ? (
                        <ArrowDownLeft className="h-4 w-4 shrink-0 text-emerald-500" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4 shrink-0 text-red-400" />
                      )}
                      {m.concepto}
                    </span>
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
                    {query ? "Sin movimientos que coincidan con la búsqueda." : "Sin movimientos para este medio de pago."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <ChartTitle align="left" divider>
              Por medio de pago (ARS)
            </ChartTitle>
            <ul className="space-y-2 text-sm">
              {porMedio.length === 0 && <li className="text-neutral-400">Sin movimientos hoy.</li>}
              {porMedio.map((p) => (
                <li key={p.medio} className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                    <span
                      className={cn("h-1.5 w-1.5 rounded-full", dotClass[medioPagoCfg[p.medio].tone])}
                    />
                    {medioPagoCfg[p.medio].label}
                  </span>
                  <span className="text-end tabular-nums">
                    <span className="block">{fmtArs(p.total)}</span>
                    <span className="block text-[11px] font-normal text-neutral-400">
                      ≈ {fmtUsd(p.total / RATE)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5">
            <ChartTitle align="left" divider>
              Conciliaciones anteriores
            </ChartTitle>
            <ul className="space-y-3 text-sm">
              {conciliaciones.length === 0 && (
                <li className="text-neutral-400">Todavía no se concilió ninguna caja.</li>
              )}
              {conciliaciones.map((c) => {
                const diffs = c.lineas.filter((l) => l.montoReal !== l.montoSistema);
                return (
                  <li key={c.id}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {c.fecha} · {c.hora}
                      </span>
                      <span className={diffs.length ? "text-xs text-red-500" : "text-xs text-emerald-600"}>
                        {diffs.length ? `${diffs.length} con diferencia` : "Sin diferencias"}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400">{c.responsable}</p>
                    {diffs.map((l) => {
                      const caja = cajaById.get(l.cajaId);
                      const diff = l.montoReal - l.montoSistema;
                      return (
                        <p key={l.cajaId} className="mt-1 text-xs text-neutral-500">
                          <span className="font-medium text-neutral-700">
                            {caja?.nombre ?? l.cajaId}:
                          </span>{" "}
                          {diff > 0 ? "+" : ""}
                          {money(caja?.moneda ?? "ars", diff)}
                          {l.comentario && ` — ${l.comentario}`}
                        </p>
                      );
                    })}
                    {c.comentario && (
                      <p className="mt-1 text-xs italic text-neutral-500">{c.comentario}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>

      <div>
        <button
          onClick={() => setCajasOpen((v) => !v)}
          className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-neutral-400 hover:text-neutral-600"
        >
          {cajasOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {cajasOpen ? "Ocultar cajas" : "Mostrar cajas"}
        </button>
        {cajasOpen && (
          <Card className="mt-3 overflow-hidden">
            <div className="flex flex-col gap-2 border-b border-neutral-100 px-5 pt-5 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <p className={HEAD}>Cajas</p>
              <button
                onClick={() => setEditingCaja({ id: null, data: blankCaja })}
                className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-accent/40 px-4 text-sm font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                Nueva caja
              </button>
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
                    <button
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
                      className="flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-accent/40 px-3 text-xs font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </button>
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
                        <button
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
                          className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-accent/40 px-3 text-xs font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      <Dialog
        open={!!openMov}
        onClose={() => setOpenMov(null)}
        size="lg"
        accent
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
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-red-200 px-4 text-sm font-semibold text-red-600 transition-colors hover:border-red-300 hover:bg-red-50 sm:mr-auto sm:w-auto"
                >
                  <Trash2 className="h-4 w-4" /> Eliminar movimiento
                </button>
              )}
              <button
                onClick={() => setOpenMov(null)}
                className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50 sm:w-auto"
              >
                Cerrar
              </button>
            </>
          )
        }
      >
        {openMov && (
          <div>
            <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Información general
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Card className="p-2 text-center">
                <p className="font-grotesk truncate border-b border-neutral-300 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                  Caja
                </p>
                <p className="mt-1.5 truncate text-sm font-normal text-neutral-600">{cajaDe(openMov).nombre}</p>
              </Card>
              <Card className="p-2 text-center">
                <p className="font-grotesk truncate border-b border-neutral-300 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                  Moneda
                </p>
                <p className="mt-1.5 truncate text-sm font-normal text-neutral-600">
                  {cajaDe(openMov).moneda.toUpperCase()}
                </p>
              </Card>
              <Card className="p-2 text-center">
                <p className="font-grotesk truncate border-b border-neutral-300 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                  Tipo
                </p>
                <p className="mt-1.5 truncate text-sm font-normal text-neutral-600">
                  {openMov.tipo === "ingreso" ? "Ingreso" : "Egreso"}
                </p>
              </Card>
              <Card className="p-2 text-center">
                <p className="font-grotesk truncate border-b border-neutral-300 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                  Medio de pago
                </p>
                <p className="mt-1.5 truncate text-sm font-normal text-neutral-600">
                  {medioPagoCfg[openMov.medioPago].label}
                </p>
              </Card>
              <Card className="p-2 text-center">
                <p className="font-grotesk truncate border-b border-neutral-300 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
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
                <p className="font-grotesk truncate border-b border-neutral-300 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
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
        monto,
      });
      onCreate(mov);
      onClose();
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      accent
      title="Nuevo movimiento"
      footer={
        <>
          <button
            onClick={onClose}
            className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50 sm:w-auto"
          >
            Cancelar
          </button>
          <button
            disabled={!valid || pending}
            onClick={submit}
            className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
          >
            {pending ? "Registrando…" : "Registrar movimiento"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Tipo">
          <Select value={tipo} onChange={(e) => setTipo(e.target.value as "ingreso" | "egreso")}>
            <option value="ingreso">Ingreso</option>
            <option value="egreso">Egreso</option>
          </Select>
        </Field>
        <Field label="Concepto">
          <Input
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            placeholder="Ej. Compra repuestos — PartsAR"
          />
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
        {cajas.length === 0 && (
          <p className="text-xs text-red-600">
            Todavía no hay ninguna caja creada. Abrí «Cajas» al final de la página
            y creá una con «Nueva caja» antes de registrar un movimiento.
          </p>
        )}
        {caja && (
          <p className="text-xs text-neutral-400">
            Medio de pago: <span className="text-neutral-600">{medioPagoCfg[caja.medioPago].label}</span>
          </p>
        )}
        <Field label={`Monto${caja ? ` (${caja.moneda.toUpperCase()})` : ""}`}>
          <Input
            type="number"
            min={0}
            value={monto || ""}
            onChange={(e) => setMonto(Number(e.target.value))}
            placeholder="0"
          />
        </Field>
        {caja?.moneda === "ars" && monto > 0 && (
          <p className="text-xs text-neutral-400">≈ {fmtUsd(monto / rate)}</p>
        )}
        <p className="text-[11px] text-neutral-400">
          Se registra como <span className="text-neutral-600">{usuarioNombre}</span>.
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
      accent
      title={entry?.id ? "Editar caja" : "Nueva caja"}
      footer={
        <>
          <button
            onClick={onClose}
            className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50 sm:w-auto"
          >
            Cancelar
          </button>
          <button
            disabled={!draft.nombre.trim() || pending}
            onClick={submit}
            className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
          >
            {pending ? "Guardando…" : "Guardar"}
          </button>
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
        <div className="grid grid-cols-2 gap-3">
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
      accent
      size="lg"
      title="Conciliar cajas"
      description="Contá cada caja y anotá el monto real — la diferencia con el sistema queda guardada."
      footer={
        <>
          <button
            onClick={onClose}
            className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50 sm:w-auto"
          >
            Cancelar
          </button>
          <button
            disabled={!valid || pending}
            onClick={submit}
            className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
          >
            {pending ? "Confirmando…" : "Confirmar conciliación"}
          </button>
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
