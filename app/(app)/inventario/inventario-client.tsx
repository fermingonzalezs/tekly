"use client";

import { Fragment, useEffect, useState, useTransition } from "react";
import {
  Plus,
  ClipboardCheck,
  Search,
  ChevronDown,
  ChevronUp,
  Tag,
  Trash2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { StatCard } from "@/components/ui/stat-card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { InventarioValor } from "@/components/inventario-valor";
import { InventarioUnidades } from "@/components/inventario-unidades";
import {
  equipoStatus,
  otroCategoria,
  repuestoEstado,
  dotClass,
} from "@/lib/status";
import { filterPill, thDivider } from "@/lib/ui-styles";
import { GHOST_STRIPES } from "@/lib/chart";
import { fmtUsd } from "@/lib/format";
import { otroCantidad, otroCostoPromedio, otroValorStock } from "@/lib/otros";
import { cn } from "@/lib/utils";
import type {
  Equipo,
  EquipoStatus,
  Movimiento,
  OtroCategoria,
  OtroItem,
  OtroUnidad,
  Repuesto,
} from "@/lib/types";
import {
  createEquipoAction,
  updateEquipoAction,
  deleteEquipoAction,
  updateRepuestoAction,
  nuevoRepuestoAction,
  ingresoRepuestoAction,
  recuentoRepuestosAction,
  deleteRepuestoAction,
  updateOtroAction,
  nuevoOtroAction,
  ingresoOtroAction,
  recuentoOtrosAction,
  deleteOtroAction,
  getMovimientosAction,
} from "./actions";
import type { EquipoInput, RepuestoInput } from "@/lib/db/inventario";
import type { SessionUser } from "@/lib/auth/types";

type Tab = "equipos" | "repuestos" | "otros";
const CATS: OtroCategoria[] = [
  "ipad",
  "airpods",
  "tablet",
  "accesorio",
  "otro",
];

function StatsToggle({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex justify-end">
      <button
        onClick={onToggle}
        className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-neutral-400 hover:text-neutral-600"
      >
        {open ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
        {open ? "Ocultar tarjetas" : "Mostrar tarjetas"}
      </button>
    </div>
  );
}

function MovimientosLog({ movimientos }: { movimientos: Movimiento[] | null }) {
  return (
    <div>
      <p className="mb-2 border-b border-neutral-200 pb-2 text-start text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
        Movimientos
      </p>
      <div className="overflow-hidden rounded-xl border border-neutral-200 font-mono">
        <div className="grid grid-cols-[1fr_120px_84px] gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
          <span>Movimiento</span>
          <span>Fecha y hora</span>
          <span>Usuario</span>
        </div>
        {movimientos === null ? (
          <p className="px-4 py-3 text-center text-[13px] text-neutral-400">
            Cargando…
          </p>
        ) : movimientos.length === 0 ? (
          <p className="px-4 py-3 text-center text-[13px] text-neutral-400">
            Sin movimientos registrados.
          </p>
        ) : (
          movimientos.map((m, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_120px_84px] items-center gap-2 border-t border-neutral-100 px-4 py-2 text-[12px] first:border-t-0"
            >
              <span className="truncate text-start text-neutral-800">
                {m.detalle}
              </span>
              <span className="text-center text-neutral-500">
                {m.fecha} · {m.hora}
              </span>
              <span className="truncate text-center text-accent">
                {m.usuario}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** Trae el historial de movimientos de un ítem cuando su diálogo se abre. */
function useMovimientos(itemType: "equipo" | "repuesto" | "otro", itemId: string | null) {
  const [movimientos, setMovimientos] = useState<Movimiento[] | null>(null);
  useEffect(() => {
    if (!itemId) {
      setMovimientos(null);
      return;
    }
    let cancelado = false;
    setMovimientos(null);
    getMovimientosAction(itemType, itemId).then((m) => {
      if (!cancelado) setMovimientos(m);
    });
    return () => {
      cancelado = true;
    };
  }, [itemType, itemId]);
  return movimientos;
}

export function InventarioClient({
  initialEquipos,
  initialRepuestos,
  initialOtros,
  user,
}: {
  initialEquipos: Equipo[];
  initialRepuestos: Repuesto[];
  initialOtros: OtroItem[];
  user: SessionUser;
}) {
  const esAdmin = user.rol === "admin";
  const [, startDeleteTransition] = useTransition();
  const [tab, setTab] = useState<Tab>("equipos");
  const [equipos, setEquipos] = useState<Equipo[]>(initialEquipos);
  const [repuestos, setRepuestos] = useState<Repuesto[]>(initialRepuestos);
  const [otros, setOtros] = useState<OtroItem[]>(initialOtros);

  const [recuento, setRecuento] = useState(false);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [savingRecuento, startRecuentoSave] = useTransition();
  const [q, setQ] = useState("");
  const [statsOpen, setStatsOpen] = useState(true);
  const [chartsOpen, setChartsOpen] = useState(true);
  const [equipoFiltro, setEquipoFiltro] = useState<
    "todos" | "disponible" | "reservado"
  >("todos");
  const [repuestoFiltro, setRepuestoFiltro] = useState<
    "todos" | "bajo" | "sin"
  >("todos");
  const [otroFiltro, setOtroFiltro] = useState<"todos" | "serializado">(
    "todos",
  );

  const [addEquipo, setAddEquipo] = useState(false);
  const [addRepuesto, setAddRepuesto] = useState(false);
  const [addOtro, setAddOtro] = useState(false);
  const [openEquipoId, setOpenEquipoId] = useState<string | null>(null);
  const [openRepuestoId, setOpenRepuestoId] = useState<string | null>(null);
  const [openOtroId, setOpenOtroId] = useState<string | null>(null);
  const [reponerId, setReponerId] = useState<string | null>(null);
  const [expandedOtros, setExpandedOtros] = useState<Set<string>>(new Set());
  const openEquipo = equipos.find((e) => e.id === openEquipoId) ?? null;
  const openRepuesto = repuestos.find((r) => r.id === openRepuestoId) ?? null;
  const openOtro = otros.find((o) => o.id === openOtroId) ?? null;

  function toggleExpandOtro(id: string) {
    setExpandedOtros((p) => {
      const next = new Set(p);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function reponer(id: string) {
    setReponerId(id);
    setAddRepuesto(true);
  }

  function switchTab(t: Tab) {
    setRecuento(false);
    setQ("");
    setEquipoFiltro("todos");
    setRepuestoFiltro("todos");
    setOtroFiltro("todos");
    setTab(t);
  }

  const needle = q.trim().toLowerCase();
  const equiposFiltrados = equipos.filter(
    (e) =>
      (equipoFiltro === "todos" || e.estado === equipoFiltro) &&
      (!needle ||
        e.modelo.toLowerCase().includes(needle) ||
        e.color.toLowerCase().includes(needle) ||
        e.imei.toLowerCase().includes(needle)),
  );
  const repuestosFiltrados = repuestos.filter(
    (r) =>
      (repuestoFiltro === "todos" ||
        (repuestoFiltro === "bajo"
          ? r.stock > 0 && r.stock <= r.stockMin
          : r.stock <= 0)) &&
      (!needle ||
        r.nombre.toLowerCase().includes(needle) ||
        r.sku.toLowerCase().includes(needle) ||
        r.modelo.toLowerCase().includes(needle) ||
        r.proveedor.toLowerCase().includes(needle)),
  );
  const otrosFiltrados = otros.filter(
    (o) =>
      (otroFiltro === "todos" || o.serializado) &&
      (!needle || o.nombre.toLowerCase().includes(needle)),
  );

  function startRecuento() {
    const d: Record<string, number> = {};
    if (tab === "repuestos") repuestos.forEach((r) => (d[r.id] = r.stock));
    else otros.forEach((o) => !o.serializado && (d[o.id] = o.cantidad));
    setDraft(d);
    setRecuento(true);
  }
  function saveRecuento() {
    startRecuentoSave(async () => {
      if (tab === "repuestos") {
        await recuentoRepuestosAction(draft);
        setRepuestos((p) =>
          p.map((r) => ({ ...r, stock: draft[r.id] ?? r.stock })),
        );
      } else {
        await recuentoOtrosAction(draft);
        setOtros((p) =>
          p.map((o) =>
            o.serializado ? o : { ...o, cantidad: draft[o.id] ?? o.cantidad },
          ),
        );
      }
      setRecuento(false);
    });
  }

  return (
    <>
      <div className="space-y-5">
        <div>
          <div className="flex justify-end">
            <button
              onClick={() => setChartsOpen((v) => !v)}
              className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-neutral-400 hover:text-neutral-600"
            >
              {chartsOpen ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              {chartsOpen ? "Ocultar gráficos" : "Mostrar gráficos"}
            </button>
          </div>
          {chartsOpen && (
            <div className="mt-3 grid gap-5 lg:grid-cols-2">
              <InventarioValor
                equipos={equipos}
                repuestos={repuestos}
                otros={otros}
              />
              <InventarioUnidades
                equipos={equipos}
                repuestos={repuestos}
                otros={otros}
              />
            </div>
          )}
        </div>

        {/* tabs + filtros + acción, todo en la misma fila */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                tab === "equipos"
                  ? "Buscar por modelo, color o IMEI…"
                  : tab === "repuestos"
                    ? "Buscar por nombre, SKU, modelo o proveedor…"
                    : "Buscar por nombre…"
              }
              className={cn("w-64 pl-9", filterPill)}
            />
          </div>
          <Tabs
            value={tab}
            onChange={switchTab}
            options={[
              {
                value: "equipos",
                label: "Equipos para venta",
                count: equipos.length,
              },
              {
                value: "repuestos",
                label: "Repuestos",
                count: repuestos.length,
              },
              { value: "otros", label: "Otros", count: otros.length },
            ]}
          />
          <div className="ml-auto flex items-center gap-2">
            {(tab === "repuestos" || tab === "otros") &&
              (recuento ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRecuento(false)}
                    disabled={savingRecuento}
                  >
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={saveRecuento} disabled={savingRecuento}>
                    {savingRecuento ? "Guardando…" : "Guardar recuento"}
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={startRecuento}>
                  <ClipboardCheck className="h-4 w-4" /> Recuento
                </Button>
              ))}
            {!recuento && (
              <button
                onClick={() =>
                  tab === "equipos"
                    ? setAddEquipo(true)
                    : tab === "repuestos"
                      ? setAddRepuesto(true)
                      : setAddOtro(true)
                }
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-accent/40 px-4 text-sm font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft"
              >
                <Plus className="h-4 w-4" />
                {tab === "equipos"
                  ? "Agregar equipo"
                  : tab === "repuestos"
                    ? "Agregar / ingresar repuesto"
                    : "Agregar / ingresar producto"}
              </button>
            )}
          </div>
        </div>

        {/* ── Equipos ───────────────────────────── */}
        {tab === "equipos" &&
          (() => {
            const disponibles = equipos.filter(
              (e) => e.estado === "disponible",
            ).length;
            const reservados = equipos.filter(
              (e) => e.estado === "reservado",
            ).length;
            const valor = equipos
              .filter((e) => e.estado !== "vendido")
              .reduce((a, e) => a + e.costoUsd, 0);

            return (
              <>
                <StatsToggle
                  open={statsOpen}
                  onToggle={() => setStatsOpen((v) => !v)}
                />
                {statsOpen && (
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <StatCard
                      align="left"
                      label="Equipos"
                      value={equipos.length}
                      hint="unidades"
                      active={equipoFiltro === "todos"}
                      onClick={() => setEquipoFiltro("todos")}
                    />
                    <StatCard
                      align="left"
                      label="Disponibles"
                      value={disponibles}
                      hint="para vender"
                      active={equipoFiltro === "disponible"}
                      onClick={() =>
                        setEquipoFiltro(
                          equipoFiltro === "disponible" ? "todos" : "disponible",
                        )
                      }
                    />
                    <StatCard
                      align="left"
                      label="Reservados"
                      value={reservados}
                      hint="turno pendiente"
                      valueClassName={reservados ? "text-blue-600" : undefined}
                      active={equipoFiltro === "reservado"}
                      onClick={() =>
                        setEquipoFiltro(
                          equipoFiltro === "reservado" ? "todos" : "reservado",
                        )
                      }
                    />
                    <StatCard
                      align="left"
                      label="Valor de stock"
                      value={fmtUsd(valor)}
                      hint="a costo"
                    />
                  </div>
                )}

                <Card className="overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-100 text-xs text-neutral-400">
                        <th className={cn("px-5 py-3 text-center", thDivider)}>
                          Equipo
                        </th>
                        <th className={cn("px-5 py-3 text-center", thDivider)}>
                          Color
                        </th>
                        <th className={cn("px-5 py-3 text-center", thDivider)}>
                          Almacenamiento
                        </th>
                        <th className={cn("px-5 py-3 text-center", thDivider)}>
                          IMEI/Serial
                        </th>
                        <th className={cn("px-5 py-3 text-center", thDivider)}>
                          Batería
                        </th>
                        <th className={cn("px-5 py-3 text-center", thDivider)}>
                          Condición
                        </th>
                        <th className={cn("px-5 py-3 text-center", thDivider)}>
                          Costo
                        </th>
                        <th className={cn("px-5 py-3 text-center", thDivider)}>
                          Venta
                        </th>
                        <th className={cn("px-5 py-3 text-center", thDivider)}>
                          Margen
                        </th>
                        <th className="px-5 py-3 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {equiposFiltrados.map((e) => (
                        <tr
                          key={e.id}
                          onClick={() => setOpenEquipoId(e.id)}
                          className="cursor-pointer border-t border-neutral-100 first:border-t-0 hover:bg-neutral-50"
                        >
                          <td className="max-w-[160px] truncate px-5 py-2 text-center font-medium">
                            {e.modelo}
                          </td>
                          <td className="max-w-[110px] truncate px-5 py-2 text-center text-neutral-500">
                            {e.color}
                          </td>
                          <td className="px-5 py-2 text-center tabular-nums">
                            {e.almacenamiento}
                          </td>
                          <td className="px-5 py-2 text-center text-neutral-500">
                            {e.imei}
                          </td>
                          <td className="px-5 py-2 text-center tabular-nums">
                            {e.bateria}%
                          </td>
                          <td className="px-5 py-2 text-center text-neutral-500">
                            {e.condicion}
                          </td>
                          <td className="px-5 py-2 text-center tabular-nums text-neutral-500">
                            {fmtUsd(e.costoUsd)}
                          </td>
                          <td className="px-5 py-2 text-center font-semibold tabular-nums">
                            {fmtUsd(e.precioUsd)}
                          </td>
                          <td className="px-5 py-2 text-center tabular-nums text-emerald-600">
                            {(
                              ((e.precioUsd - e.costoUsd) / e.precioUsd) *
                              100
                            ).toFixed(0)}
                            %
                          </td>
                          <td className="px-5 py-2 text-center">
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full",
                                  dotClass[equipoStatus[e.estado].tone],
                                )}
                              />
                              {equipoStatus[e.estado].label}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {equiposFiltrados.length === 0 && (
                        <tr>
                          <td
                            colSpan={10}
                            className="px-5 py-10 text-center text-sm text-neutral-400"
                          >
                            Sin equipos para esta búsqueda.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </Card>
              </>
            );
          })()}

        {/* ── Repuestos ─────────────────────────── */}
        {tab === "repuestos" &&
          (() => {
            const nBajo = repuestos.filter(
              (r) => r.stock > 0 && r.stock <= r.stockMin,
            ).length;
            const nSin = repuestos.filter((r) => r.stock <= 0).length;
            const valor = repuestos.reduce(
              (a, r) => a + r.stock * r.costoUsd,
              0,
            );
            const reponerList = repuestos
              .filter((r) => r.stock <= r.stockMin)
              .sort((a, b) => a.stock / a.stockMin - b.stock / b.stockMin);

            return (
              <>
                <StatsToggle
                  open={statsOpen}
                  onToggle={() => setStatsOpen((v) => !v)}
                />
                {statsOpen && (
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <StatCard
                      align="left"
                      label="Repuestos"
                      value={repuestos.length}
                      hint="SKUs"
                      active={repuestoFiltro === "todos"}
                      onClick={() => setRepuestoFiltro("todos")}
                    />
                    <StatCard
                      align="left"
                      label="Stock bajo"
                      value={nBajo}
                      hint="≤ punto de repo."
                      active={repuestoFiltro === "bajo"}
                      onClick={() =>
                        setRepuestoFiltro(
                          repuestoFiltro === "bajo" ? "todos" : "bajo",
                        )
                      }
                    />
                    <StatCard
                      align="left"
                      label="Sin stock"
                      value={nSin}
                      hint="reponer ya"
                      active={repuestoFiltro === "sin"}
                      onClick={() =>
                        setRepuestoFiltro(
                          repuestoFiltro === "sin" ? "todos" : "sin",
                        )
                      }
                    />
                    <StatCard
                      align="left"
                      label="Valor de stock"
                      value={fmtUsd(valor)}
                      hint="a costo"
                    />
                  </div>
                )}

                {recuento && (
                  <p className="text-sm text-neutral-500">
                    Ajustá el stock real de cada repuesto y guardá el recuento.
                  </p>
                )}

                <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
                  <Card className="overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-neutral-100 text-xs text-neutral-400">
                          <th
                            className={cn("px-5 py-3 text-center", thDivider)}
                          >
                            Repuesto
                          </th>
                          <th
                            className={cn("px-5 py-3 text-center", thDivider)}
                          >
                            Modelo
                          </th>
                          <th
                            className={cn("px-5 py-3 text-center", thDivider)}
                          >
                            Stock
                          </th>
                          <th
                            className={cn("px-5 py-3 text-center", thDivider)}
                          >
                            Costo
                          </th>
                          <th
                            className={cn("px-5 py-3 text-center", thDivider)}
                          >
                            Estado
                          </th>
                          <th className="px-5 py-3 text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {repuestosFiltrados.map((r) => {
                          const est = repuestoEstado(r.stock, r.stockMin);
                          const frac = Math.max(
                            0,
                            Math.min(1, r.stock / (r.stockMin * 2)),
                          );
                          const barColor =
                            r.stock <= 0
                              ? "bg-red-500"
                              : r.stock <= r.stockMin
                                ? "bg-amber-500"
                                : "bg-emerald-500";
                          return (
                            <tr
                              key={r.id}
                              onClick={() =>
                                !recuento && setOpenRepuestoId(r.id)
                              }
                              className={cn(
                                "border-t border-neutral-100 first:border-t-0",
                                !recuento && "cursor-pointer hover:bg-neutral-50",
                                r.stock <= 0 && "bg-red-50/50",
                                r.stock > 0 &&
                                  r.stock <= r.stockMin &&
                                  "bg-amber-50/40",
                              )}
                            >
                              <td className="max-w-[160px] truncate px-5 py-2 text-center">
                                <span className="font-medium">{r.nombre}</span>
                                <span className="block truncate text-xs text-neutral-400">
                                  {r.sku}
                                </span>
                              </td>
                              <td className="max-w-[120px] truncate px-5 py-2 text-center text-neutral-500">
                                {r.modelo}
                              </td>
                              <td className="px-5 py-2 text-center">
                                {recuento ? (
                                  <Input
                                    type="number"
                                    min={0}
                                    value={draft[r.id] ?? r.stock}
                                    onChange={(e) =>
                                      setDraft((d) => ({
                                        ...d,
                                        [r.id]: Number(e.target.value) || 0,
                                      }))
                                    }
                                    className="mx-auto h-8 w-20 text-center"
                                  />
                                ) : (
                                  <div className="mx-auto w-24">
                                    <p className="tabular-nums">
                                      <span className="font-semibold">
                                        {r.stock}
                                      </span>
                                      <span className="text-xs text-neutral-400">
                                        {" "}
                                        / mín {r.stockMin}
                                      </span>
                                    </p>
                                    <div
                                      className="mt-1 h-1.5 overflow-hidden rounded-full"
                                      style={{ background: GHOST_STRIPES }}
                                    >
                                      <div
                                        className={cn(
                                          "h-full rounded-full",
                                          barColor,
                                        )}
                                        style={{ width: `${frac * 100}%` }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </td>
                              <td className="px-5 py-2 text-center tabular-nums text-neutral-500">
                                {fmtUsd(r.costoUsd)}
                              </td>
                              <td className="px-5 py-2 text-center">
                                <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                                  <span
                                    className={cn(
                                      "h-1.5 w-1.5 rounded-full",
                                      dotClass[est.tone],
                                    )}
                                  />
                                  {est.label}
                                </span>
                              </td>
                              <td className="px-5 py-2 text-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    reponer(r.id);
                                  }}
                                  className="mx-auto flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-accent/40 px-3 text-xs font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft"
                                >
                                  Reponer
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {repuestosFiltrados.length === 0 && (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-5 py-10 text-center text-sm text-neutral-400"
                            >
                              Sin repuestos para esta búsqueda.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </Card>

                  <Card className="p-5">
                    <div className="flex items-baseline justify-between border-b border-neutral-100 pb-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                        Reponer pronto
                      </p>
                      <span className="text-xs text-neutral-400">
                        {reponerList.length} bajo el mínimo
                      </span>
                    </div>
                    {reponerList.length === 0 ? (
                      <p className="mt-4 text-sm text-neutral-400">
                        Todo por encima del mínimo.
                      </p>
                    ) : (
                      <ul className="mt-3 space-y-3">
                        {reponerList.map((r) => {
                          const pct = Math.round((r.stock / r.stockMin) * 100);
                          return (
                            <li
                              key={r.id}
                              className="border-b border-neutral-100 pb-3 last:border-b-0 last:pb-0"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate text-sm font-medium">
                                  {r.nombre}
                                </span>
                                <button
                                  onClick={() => reponer(r.id)}
                                  className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white"
                                >
                                  Reponer
                                </button>
                              </div>
                              <p className="text-[11px] text-neutral-400">
                                {r.sku} · {r.proveedor}
                              </p>
                              <div className="mt-1.5 flex items-center gap-2">
                                <span className="text-xs font-semibold tabular-nums">
                                  {r.stock} / {r.stockMin}
                                </span>
                                <div
                                  className="h-1.5 flex-1 overflow-hidden rounded-full"
                                  style={{ background: GHOST_STRIPES }}
                                >
                                  <div
                                    className={cn(
                                      "h-full rounded-full",
                                      r.stock <= 0
                                        ? "bg-red-500"
                                        : "bg-amber-500",
                                    )}
                                    style={{ width: `${Math.min(100, pct)}%` }}
                                  />
                                </div>
                                <span className="text-[11px] text-neutral-400">
                                  {pct}%
                                </span>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </Card>
                </div>
              </>
            );
          })()}

        {/* ── Otros ─────────────────────────────── */}
        {tab === "otros" &&
          (() => {
            const unidades = otros.reduce((a, o) => a + otroCantidad(o), 0);
            const serializados = otros.filter((o) => o.serializado).length;
            const valor = otros.reduce((a, o) => a + otroValorStock(o), 0);

            return (
              <>
                <StatsToggle
                  open={statsOpen}
                  onToggle={() => setStatsOpen((v) => !v)}
                />
                {statsOpen && (
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <StatCard
                      align="left"
                      label="Productos"
                      value={otros.length}
                      hint="SKUs"
                      active={otroFiltro === "todos"}
                      onClick={() => setOtroFiltro("todos")}
                    />
                    <StatCard
                      align="left"
                      label="Unidades"
                      value={unidades}
                      hint="en stock"
                    />
                    <StatCard
                      align="left"
                      label="Serializados"
                      value={serializados}
                      hint="con IMEI/serial"
                      active={otroFiltro === "serializado"}
                      onClick={() =>
                        setOtroFiltro(
                          otroFiltro === "serializado" ? "todos" : "serializado",
                        )
                      }
                    />
                    <StatCard
                      align="left"
                      label="Valor de stock"
                      value={fmtUsd(valor)}
                      hint="a costo"
                    />
                  </div>
                )}

                {recuento && (
                  <p className="text-sm text-neutral-500">
                    Ajustá la cantidad real de cada producto y guardá el
                    recuento.
                  </p>
                )}
                <Card className="overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-100 text-xs text-neutral-400">
                        <th className={cn("px-5 py-3 text-center", thDivider)}>
                          Producto
                        </th>
                        <th className={cn("px-5 py-3 text-center", thDivider)}>
                          Descripción
                        </th>
                        <th className={cn("px-5 py-3 text-center", thDivider)}>
                          Categoría
                        </th>
                        <th className={cn("px-5 py-3 text-center", thDivider)}>
                          Costo
                        </th>
                        <th className={cn("px-5 py-3 text-center", thDivider)}>
                          Precio
                        </th>
                        <th className="px-5 py-3 text-center">Cantidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {otrosFiltrados.map((o) => {
                        const cantidad = otroCantidad(o);
                        const expanded = expandedOtros.has(o.id);
                        return (
                          <Fragment key={o.id}>
                            <tr
                              onClick={() => !recuento && setOpenOtroId(o.id)}
                              className={cn(
                                "border-t border-neutral-100 first:border-t-0",
                                !recuento && "cursor-pointer hover:bg-neutral-50",
                              )}
                            >
                              <td className="max-w-[180px] truncate px-5 py-2 text-start font-medium">
                                <span className="inline-flex items-center gap-1">
                                  <span className="flex w-3.5 shrink-0 justify-center">
                                    {o.serializado && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleExpandOtro(o.id);
                                        }}
                                        className="text-neutral-400 hover:text-accent"
                                      >
                                        {expanded ? (
                                          <ChevronUp className="h-3.5 w-3.5" />
                                        ) : (
                                          <ChevronDown className="h-3.5 w-3.5" />
                                        )}
                                      </button>
                                    )}
                                  </span>
                                  <span className="truncate">{o.nombre}</span>
                                </span>
                              </td>
                              <td className="max-w-[220px] truncate px-5 py-2 text-start text-neutral-500">
                                {o.descripcion ?? "—"}
                              </td>
                              <td className="px-5 py-2 text-center">
                                <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                                  <span
                                    className={cn(
                                      "h-1.5 w-1.5 rounded-full",
                                      dotClass[otroCategoria[o.categoria].tone],
                                    )}
                                  />
                                  {otroCategoria[o.categoria].label}
                                </span>
                              </td>
                              <td className="px-5 py-2 text-center tabular-nums text-neutral-500">
                                {fmtUsd(otroCostoPromedio(o))}
                                {o.serializado && (
                                  <span className="ml-1 text-[10px] text-neutral-400">
                                    prom.
                                  </span>
                                )}
                              </td>
                              <td className="px-5 py-2 text-center font-semibold tabular-nums">
                                {fmtUsd(o.precioUsd)}
                              </td>
                              <td className="px-5 py-2 text-center font-semibold tabular-nums">
                                {o.serializado ? (
                                  <span className="inline-flex items-center gap-1 text-neutral-700">
                                    {cantidad}
                                    <Tag className="h-3 w-3 text-neutral-400" />
                                  </span>
                                ) : recuento ? (
                                  <Input
                                    type="number"
                                    min={0}
                                    value={draft[o.id] ?? o.cantidad}
                                    onChange={(e) =>
                                      setDraft((d) => ({
                                        ...d,
                                        [o.id]: Number(e.target.value) || 0,
                                      }))
                                    }
                                    className="mx-auto h-8 w-20 text-center"
                                  />
                                ) : (
                                  cantidad
                                )}
                              </td>
                            </tr>
                            {o.serializado && expanded && (
                              <tr className="bg-neutral-50">
                                <td colSpan={6} className="px-5 py-3">
                                  <div className="overflow-hidden rounded-lg border border-neutral-200 font-mono">
                                    <div className="grid grid-cols-[1fr_1fr_84px] gap-2 border-b border-neutral-200 bg-neutral-100 px-3 py-1.5 text-start text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                                      <span>Serial</span>
                                      <span>Color</span>
                                      <span className="text-end">Costo</span>
                                    </div>
                                    {o.unidades.map((u) => (
                                      <div
                                        key={u.serial}
                                        className="grid grid-cols-[1fr_1fr_84px] items-center gap-2 border-t border-neutral-100 bg-white px-3 py-1.5 text-[12px] first:border-t-0"
                                      >
                                        <span className="truncate text-neutral-700">
                                          {u.serial}
                                        </span>
                                        <span className="truncate text-neutral-500">
                                          {u.color ?? "—"}
                                        </span>
                                        <span className="text-end tabular-nums text-neutral-500">
                                          {fmtUsd(u.costoUsd)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                      {otrosFiltrados.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-5 py-10 text-center text-sm text-neutral-400"
                          >
                            Sin productos para esta búsqueda.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </Card>
              </>
            );
          })()}
      </div>

      {/* Agregar equipo */}
      <EquipoFormDialog
        key={addEquipo ? "e" : "e0"}
        equipo={null}
        open={addEquipo}
        onClose={() => setAddEquipo(false)}
        onSubmit={async (data) => {
          const nuevo = await createEquipoAction(data);
          setEquipos((p) => [nuevo, ...p]);
          setAddEquipo(false);
        }}
      />

      {/* Ver / editar equipo */}
      <EquipoFormDialog
        key={openEquipoId ?? "none"}
        equipo={openEquipo}
        open={!!openEquipo}
        onClose={() => setOpenEquipoId(null)}
        onSubmit={async (data) => {
          const actualizado = await updateEquipoAction(openEquipo!.id, data);
          setEquipos((p) => p.map((x) => (x.id === actualizado.id ? actualizado : x)));
          setOpenEquipoId(null);
        }}
        onDelete={
          esAdmin
            ? () => {
                const id = openEquipo!.id;
                setEquipos((p) => p.filter((x) => x.id !== id));
                setOpenEquipoId(null);
                startDeleteTransition(async () => {
                  await deleteEquipoAction(id);
                });
              }
            : undefined
        }
      />

      {/* Agregar / ingresar repuesto */}
      <IngresoDialog
        key={addRepuesto ? `r-${reponerId ?? "x"}` : "r0"}
        open={addRepuesto}
        onClose={() => {
          setAddRepuesto(false);
          setReponerId(null);
        }}
        titulo="repuesto"
        defaultId={reponerId ?? undefined}
        existentes={repuestos.map((r) => ({
          id: r.id,
          label: `${r.nombre} · ${r.modelo}`,
        }))}
        onIngreso={async (id, cantidad, precio) => {
          const actualizado = await ingresoRepuestoAction(id, cantidad, precio);
          setRepuestos((p) => p.map((r) => (r.id === id ? actualizado : r)));
          setAddRepuesto(false);
          setReponerId(null);
        }}
        onNuevo={async (nombre, precioCompra, cantidad) => {
          const nuevo = await nuevoRepuestoAction(nombre, precioCompra, cantidad);
          setRepuestos((p) => [nuevo, ...p]);
          setAddRepuesto(false);
          setReponerId(null);
        }}
      />

      {/* Agregar / ingresar otro producto */}
      <IngresoDialog
        key={addOtro ? "o" : "o0"}
        open={addOtro}
        onClose={() => setAddOtro(false)}
        titulo="producto"
        categoria
        existentes={otros.map((o) => ({
          id: o.id,
          label: o.nombre,
          serializado: o.serializado,
        }))}
        onIngreso={async (id, cantidad, precio, unidades) => {
          const actualizado = await ingresoOtroAction(id, cantidad, precio, unidades);
          setOtros((p) => p.map((o) => (o.id === id ? actualizado : o)));
          setAddOtro(false);
        }}
        onNuevo={async (nombre, precioCompra, cantidad, cat, unidades) => {
          const nuevo = await nuevoOtroAction(nombre, precioCompra, cantidad, cat, unidades);
          setOtros((p) => [nuevo, ...p]);
          setAddOtro(false);
        }}
      />

      {/* Ver / editar repuesto */}
      <RepuestoFormDialog
        key={openRepuestoId ?? "none"}
        repuesto={openRepuesto}
        open={!!openRepuesto}
        onClose={() => setOpenRepuestoId(null)}
        onSubmit={async (data) => {
          const actualizado = await updateRepuestoAction(openRepuesto!.id, data);
          setRepuestos((p) => p.map((x) => (x.id === actualizado.id ? actualizado : x)));
          setOpenRepuestoId(null);
        }}
        onDelete={
          esAdmin
            ? () => {
                const id = openRepuesto!.id;
                setRepuestos((p) => p.filter((x) => x.id !== id));
                setOpenRepuestoId(null);
                startDeleteTransition(async () => {
                  await deleteRepuestoAction(id);
                });
              }
            : undefined
        }
      />

      {/* Ver / editar producto de "Otros" */}
      <OtroFormDialog
        key={openOtroId ?? "none"}
        item={openOtro}
        open={!!openOtro}
        onClose={() => setOpenOtroId(null)}
        onSubmit={async (o) => {
          const actualizado = await updateOtroAction(o.id, o);
          setOtros((p) => p.map((x) => (x.id === actualizado.id ? actualizado : x)));
          setOpenOtroId(null);
        }}
        onDelete={
          esAdmin
            ? () => {
                const id = openOtro!.id;
                setOtros((p) => p.filter((x) => x.id !== id));
                setOpenOtroId(null);
                startDeleteTransition(async () => {
                  await deleteOtroAction(id);
                });
              }
            : undefined
        }
      />
    </>
  );
}

// ─────────────────────────── Dialogs ───────────────────────────

const ESTADOS: EquipoStatus[] = ["en_revision", "disponible", "reservado", "vendido"];

function EquipoFormDialog({
  equipo,
  open,
  onClose,
  onSubmit,
  onDelete,
}: {
  equipo: Equipo | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (e: EquipoInput) => void | Promise<void>;
  onDelete?: () => void;
}) {
  const edit = !!equipo;
  const [f, setF] = useState<Equipo>(
    equipo ?? {
      id: "",
      modelo: "",
      almacenamiento: "128GB",
      color: "",
      imei: "",
      bateria: 100,
      condicion: "A",
      costoUsd: 0,
      precioUsd: 0,
      estado: "en_revision",
    },
  );
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof Equipo>(k: K, v: Equipo[K]) =>
    setF((p) => ({ ...p, [k]: v }));
  const valid = f.modelo.trim() && f.costoUsd > 0 && f.precioUsd > 0;
  const margen =
    f.precioUsd > 0 ? ((f.precioUsd - f.costoUsd) / f.precioUsd) * 100 : 0;

  const movimientos = useMovimientos("equipo", edit ? equipo!.id : null);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      accent
      title={edit ? `Equipo · ${equipo!.modelo}` : "Agregar equipo"}
      description={
        edit
          ? `Margen ${margen.toFixed(0)}%`
          : "Ingresa en estado «En revisión»."
      }
      footer={
        <>
          {onDelete && (
            <ConfirmButton
              label="Eliminar equipo"
              onConfirm={onDelete}
              className="mr-auto"
            />
          )}
          <button
            onClick={onClose}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
          >
            Cancelar
          </button>
          <button
            disabled={!valid || pending}
            onClick={() =>
              startTransition(async () => {
                await onSubmit({
                  modelo: f.modelo.trim(),
                  almacenamiento: f.almacenamiento,
                  color: f.color.trim() || "—",
                  imei: f.imei.trim() || "—",
                  bateria: f.bateria,
                  condicion: f.condicion,
                  costoUsd: f.costoUsd,
                  precioUsd: f.precioUsd,
                  estado: f.estado,
                });
              })
            }
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:pointer-events-none disabled:opacity-50"
          >
            {pending ? "Guardando…" : edit ? "Guardar" : "Agregar"}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            Información general
          </p>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Modelo">
              <Input
                value={f.modelo}
                onChange={(e) => set("modelo", e.target.value)}
                placeholder="iPhone 13"
              />
            </Field>
            <Field label="Almacenamiento">
              <Select
                value={f.almacenamiento}
                onChange={(e) => set("almacenamiento", e.target.value)}
              >
                {["64GB", "128GB", "256GB", "512GB", "1TB"].map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </Select>
            </Field>
            <Field label="Color">
              <Input
                value={f.color}
                onChange={(e) => set("color", e.target.value)}
              />
            </Field>
            <Field label="IMEI/Serial">
              <Input
                value={f.imei}
                onChange={(e) => set("imei", e.target.value)}
              />
            </Field>
            <Field label="Batería (%)">
              <Input
                type="number"
                min={0}
                max={100}
                value={f.bateria}
                onChange={(e) => set("bateria", Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="Condición">
              <Select
                value={f.condicion}
                onChange={(e) => set("condicion", e.target.value)}
              >
                {["NUEVO", "A+", "A", "B+", "B", "C"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Costo (U$)">
              <Input
                type="number"
                min={0}
                value={f.costoUsd || ""}
                onChange={(e) => set("costoUsd", Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="Venta (U$)">
              <Input
                type="number"
                min={0}
                value={f.precioUsd || ""}
                onChange={(e) => set("precioUsd", Number(e.target.value) || 0)}
              />
            </Field>
            {edit && (
              <Field label="Estado">
                <Select
                  value={f.estado}
                  onChange={(e) =>
                    set("estado", e.target.value as EquipoStatus)
                  }
                >
                  {ESTADOS.map((s) => (
                    <option key={s} value={s}>
                      {equipoStatus[s].label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
        </div>

        {edit && <MovimientosLog movimientos={movimientos} />}
      </div>
    </Dialog>
  );
}

function RepuestoFormDialog({
  repuesto,
  open,
  onClose,
  onSubmit,
  onDelete,
}: {
  repuesto: Repuesto | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (r: RepuestoInput) => void | Promise<void>;
  onDelete?: () => void;
}) {
  const [f, setF] = useState<Repuesto>(
    repuesto ?? {
      id: "",
      sku: "",
      nombre: "",
      modelo: "",
      stock: 0,
      stockMin: 2,
      costoUsd: 0,
      proveedor: "",
    },
  );
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof Repuesto>(k: K, v: Repuesto[K]) =>
    setF((p) => ({ ...p, [k]: v }));
  const valid = !!f.nombre.trim() && f.costoUsd > 0;
  const movimientos = useMovimientos("repuesto", repuesto?.id ?? null);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      accent
      title={repuesto ? `Repuesto · ${repuesto.nombre}` : "Repuesto"}
      description={repuesto ? `${repuesto.modelo} · ${repuesto.sku}` : ""}
      footer={
        <>
          {onDelete && (
            <ConfirmButton
              label="Eliminar repuesto"
              onConfirm={onDelete}
              className="mr-auto"
            />
          )}
          <button
            onClick={onClose}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
          >
            Cancelar
          </button>
          <button
            disabled={!valid || pending}
            onClick={() =>
              startTransition(async () => {
                await onSubmit({
                  sku: f.sku,
                  nombre: f.nombre.trim(),
                  modelo: f.modelo,
                  stock: f.stock,
                  stockMin: f.stockMin,
                  costoUsd: f.costoUsd,
                  proveedor: f.proveedor,
                });
              })
            }
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:pointer-events-none disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Guardar"}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            Información general
          </p>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Nombre">
              <Input
                value={f.nombre}
                onChange={(e) => set("nombre", e.target.value)}
              />
            </Field>
            <Field label="SKU">
              <Input value={f.sku} onChange={(e) => set("sku", e.target.value)} />
            </Field>
            <Field label="Modelo">
              <Input
                value={f.modelo}
                onChange={(e) => set("modelo", e.target.value)}
              />
            </Field>
            <Field label="Proveedor">
              <Input
                value={f.proveedor}
                onChange={(e) => set("proveedor", e.target.value)}
              />
            </Field>
            <Field label="Stock">
              <Input
                type="number"
                min={0}
                value={f.stock}
                onChange={(e) => set("stock", Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="Stock mínimo">
              <Input
                type="number"
                min={0}
                value={f.stockMin}
                onChange={(e) => set("stockMin", Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="Costo (U$)">
              <Input
                type="number"
                min={0}
                value={f.costoUsd || ""}
                onChange={(e) => set("costoUsd", Number(e.target.value) || 0)}
              />
            </Field>
          </div>
        </div>

        {repuesto && <MovimientosLog movimientos={movimientos} />}
      </div>
    </Dialog>
  );
}

function OtroFormDialog({
  item,
  open,
  onClose,
  onSubmit,
  onDelete,
}: {
  item: OtroItem | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (o: OtroItem) => void | Promise<void>;
  onDelete?: () => void;
}) {
  const [nombre, setNombre] = useState(item?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(item?.descripcion ?? "");
  const [categoria, setCategoria] = useState<OtroCategoria>(
    item?.categoria ?? "otro",
  );
  const [precioUsd, setPrecioUsd] = useState(item?.precioUsd ?? 0);
  const [serializado, setSerializado] = useState(item?.serializado ?? false);
  const [cantidad, setCantidad] = useState(
    item && !item.serializado ? item.cantidad : 1,
  );
  const [costoUsd, setCostoUsd] = useState(
    item && !item.serializado ? item.costoUsd : 0,
  );
  const [unidadesManual, setUnidadesManual] = useState<DraftUnidad[]>(
    item && item.serializado
      ? item.unidades.map((u) => ({
          serial: u.serial,
          color: u.color ?? "",
          costoUsd: u.costoUsd,
        }))
      : [emptyUnidad()],
  );
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkColor, setBulkColor] = useState("");
  const [bulkCosto, setBulkCosto] = useState(0);
  const [pending, startTransition] = useTransition();

  const unidadesLimpias: OtroUnidad[] = unidadesManual
    .filter((u) => u.serial.trim())
    .map((u) => ({
      serial: u.serial.trim(),
      color: u.color.trim() || undefined,
      costoUsd: u.costoUsd,
    }));
  const costoPromedio = unidadesLimpias.length
    ? Math.round(
        unidadesLimpias.reduce((a, u) => a + u.costoUsd, 0) /
          unidadesLimpias.length,
      )
    : 0;
  const movimientos = useMovimientos("otro", item?.id ?? null);

  function toggleSerializado(v: boolean) {
    if (v === serializado) return;
    if (v) {
      setUnidadesManual(
        Array.from({ length: Math.max(cantidad, 1) }, () => ({
          serial: "",
          color: "",
          costoUsd,
        })),
      );
    } else {
      setCantidad(Math.max(unidadesLimpias.length, 1));
      setCostoUsd(costoPromedio || 1);
    }
    setSerializado(v);
  }
  const updUnidad = (i: number, patch: Partial<DraftUnidad>) =>
    setUnidadesManual((p) =>
      p.map((u, idx) => (idx === i ? { ...u, ...patch } : u)),
    );
  const addUnidad = () => setUnidadesManual((p) => [...p, emptyUnidad()]);
  const rmUnidad = (i: number) =>
    setUnidadesManual((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p));
  function aplicarBulk() {
    const nuevas = bulkText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((serial) => ({ serial, color: bulkColor, costoUsd: bulkCosto }));
    if (!nuevas.length) return;
    setUnidadesManual((p) => [...p.filter((u) => u.serial.trim()), ...nuevas]);
    setBulkText("");
    setBulkOpen(false);
  }

  const valid =
    !!nombre.trim() &&
    precioUsd > 0 &&
    (serializado
      ? unidadesLimpias.length > 0 &&
        unidadesLimpias.every((u) => u.costoUsd > 0)
      : cantidad > 0 && costoUsd > 0);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      accent
      title={item ? `Producto · ${item.nombre}` : "Producto"}
      description={item ? otroCategoria[item.categoria].label : ""}
      footer={
        <>
          {onDelete && (
            <ConfirmButton
              label="Eliminar producto"
              onConfirm={onDelete}
              className="mr-auto"
            />
          )}
          <button
            onClick={onClose}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
          >
            Cancelar
          </button>
          <button
            disabled={!valid || !item || pending}
            onClick={() =>
              item &&
              startTransition(async () => {
                await onSubmit({
                  id: item.id,
                  nombre: nombre.trim(),
                  descripcion: descripcion.trim() || undefined,
                  categoria,
                  precioUsd,
                  ...(serializado
                    ? { serializado: true, unidades: unidadesLimpias }
                    : { serializado: false, cantidad, costoUsd }),
                });
              })
            }
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:pointer-events-none disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Guardar"}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            Información general
          </p>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Nombre">
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </Field>
            <Field label="Categoría">
              <Select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as OtroCategoria)}
              >
                {CATS.map((c) => (
                  <option key={c} value={c}>
                    {otroCategoria[c].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Serializado">
              <div className="flex h-9 rounded-lg border border-neutral-200 p-0.5">
                {(["no", "si"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => toggleSerializado(v === "si")}
                    className={cn(
                      "flex-1 rounded-md text-[13px] font-medium transition-colors",
                      (v === "si") === serializado
                        ? "bg-accent-soft text-accent"
                        : "text-neutral-500 hover:bg-neutral-50",
                    )}
                  >
                    {v === "si" ? "Sí" : "No"}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Descripción" className="col-span-3">
              <Input
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Opcional"
              />
            </Field>
            <Field label="Costo (U$)">
              {serializado ? (
                <div className="flex h-9 items-center rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-500">
                  {fmtUsd(costoPromedio)} prom.
                </div>
              ) : (
                <Input
                  type="number"
                  min={0}
                  value={costoUsd || ""}
                  onChange={(e) => setCostoUsd(Number(e.target.value) || 0)}
                />
              )}
            </Field>
            <Field label="Venta (U$)">
              <Input
                type="number"
                min={0}
                value={precioUsd || ""}
                onChange={(e) => setPrecioUsd(Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="Cantidad">
              {serializado ? (
                <div className="flex h-9 items-center rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-500">
                  {unidadesLimpias.length}
                </div>
              ) : (
                <Input
                  type="number"
                  min={0}
                  value={cantidad}
                  onChange={(e) => setCantidad(Number(e.target.value) || 0)}
                />
              )}
            </Field>
            {serializado && (
              <Field label="Unidades" className="col-span-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                    <span className="flex-1">Serial</span>
                    <span className="w-28 text-center">Color</span>
                    <span className="w-24 text-center">Costo</span>
                    <span className="w-9" />
                  </div>
                  {unidadesManual.map((u, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        className="min-w-0 flex-1"
                        value={u.serial}
                        onChange={(e) =>
                          updUnidad(i, { serial: e.target.value })
                        }
                        placeholder={`Serial ${i + 1}`}
                      />
                      <Input
                        className="w-28"
                        value={u.color}
                        onChange={(e) =>
                          updUnidad(i, { color: e.target.value })
                        }
                        placeholder="Color"
                      />
                      <Input
                        className="w-24"
                        type="number"
                        min={0}
                        value={u.costoUsd || ""}
                        placeholder="U$"
                        onChange={(e) =>
                          updUnidad(i, {
                            costoUsd: Number(e.target.value) || 0,
                          })
                        }
                      />
                      <button
                        type="button"
                        onClick={() => rmUnidad(i)}
                        disabled={unidadesManual.length === 1}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-red-500 disabled:opacity-30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={addUnidad}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    + Agregar unidad
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkOpen((v) => !v)}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    {bulkOpen ? "Cerrar carga en bulk" : "Cargar en bulk"}
                  </button>
                </div>
                {bulkOpen && (
                  <div className="mt-2 space-y-2 rounded-lg border border-dashed border-neutral-200 p-3">
                    <Textarea
                      rows={3}
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      placeholder={"Un serial por línea\nIPAD9-010\nIPAD9-011"}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        value={bulkColor}
                        onChange={(e) => setBulkColor(e.target.value)}
                        placeholder="Color (opcional)"
                      />
                      <Input
                        type="number"
                        min={0}
                        value={bulkCosto || ""}
                        onChange={(e) =>
                          setBulkCosto(Number(e.target.value) || 0)
                        }
                        placeholder="Costo c/u (U$)"
                      />
                      <button
                        type="button"
                        onClick={aplicarBulk}
                        className="rounded-lg bg-accent px-3 text-xs font-semibold text-white transition-colors hover:bg-accent/90"
                      >
                        Agregar unidades
                      </button>
                    </div>
                  </div>
                )}
              </Field>
            )}
          </div>
        </div>

        {item && <MovimientosLog movimientos={movimientos} />}
      </div>
    </Dialog>
  );
}

type DraftUnidad = { serial: string; color: string; costoUsd: number };
const emptyUnidad = (): DraftUnidad => ({ serial: "", color: "", costoUsd: 0 });

function IngresoDialog({
  open,
  onClose,
  titulo,
  categoria,
  defaultId,
  existentes,
  onIngreso,
  onNuevo,
}: {
  open: boolean;
  onClose: () => void;
  titulo: string;
  categoria?: boolean;
  defaultId?: string;
  existentes: { id: string; label: string; serializado?: boolean }[];
  onIngreso: (
    id: string,
    cantidad: number,
    precioCompra: number,
    unidades?: OtroUnidad[],
  ) => void | Promise<void>;
  onNuevo: (
    nombre: string,
    precioCompra: number,
    cantidad: number,
    cat?: OtroCategoria,
    unidades?: OtroUnidad[],
  ) => void | Promise<void>;
}) {
  const [modo, setModo] = useState<"nuevo" | "existente">(
    existentes.length ? "existente" : "nuevo",
  );
  const [sel, setSel] = useState(defaultId ?? existentes[0]?.id ?? "");
  const [nombre, setNombre] = useState("");
  const [cat, setCat] = useState<OtroCategoria>("accesorio");
  const [serializadoNuevo, setSerializadoNuevo] = useState(false);
  const [cantidad, setCantidad] = useState(1);
  const [precio, setPrecio] = useState(0);
  const [pending, startTransition] = useTransition();

  const [modoCarga, setModoCarga] = useState<"manual" | "bulk">("manual");
  const [unidadesManual, setUnidadesManual] = useState<DraftUnidad[]>([
    emptyUnidad(),
  ]);
  const [bulkSeriales, setBulkSeriales] = useState("");
  const [bulkColor, setBulkColor] = useState("");
  const [bulkCosto, setBulkCosto] = useState(0);

  const locked = !!defaultId;
  const existenteSel = existentes.find((x) => x.id === sel);
  const esSerializado =
    modo === "existente" ? !!existenteSel?.serializado : serializadoNuevo;

  const unidadesFinal: OtroUnidad[] =
    modoCarga === "bulk"
      ? bulkSeriales
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter(Boolean)
          .map((serial) => ({
            serial,
            color: bulkColor.trim() || undefined,
            costoUsd: bulkCosto,
          }))
      : unidadesManual
          .filter((u) => u.serial.trim())
          .map((u) => ({
            serial: u.serial.trim(),
            color: u.color.trim() || undefined,
            costoUsd: u.costoUsd,
          }));
  const costoPromedioNuevos = unidadesFinal.length
    ? Math.round(
        unidadesFinal.reduce((a, u) => a + u.costoUsd, 0) /
          unidadesFinal.length,
      )
    : 0;

  const updUnidad = (i: number, patch: Partial<DraftUnidad>) =>
    setUnidadesManual((p) =>
      p.map((u, idx) => (idx === i ? { ...u, ...patch } : u)),
    );
  const addUnidad = () => setUnidadesManual((p) => [...p, emptyUnidad()]);
  const rmUnidad = (i: number) =>
    setUnidadesManual((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p));

  const valid =
    (modo === "existente" ? !!sel : !!nombre.trim()) &&
    (esSerializado
      ? unidadesFinal.length > 0 && unidadesFinal.every((u) => u.costoUsd > 0)
      : cantidad > 0 && precio > 0);

  function submit() {
    startTransition(async () => {
      if (modo === "existente") {
        await onIngreso(
          sel,
          esSerializado ? unidadesFinal.length : cantidad,
          esSerializado ? costoPromedioNuevos : precio,
          esSerializado ? unidadesFinal : undefined,
        );
      } else {
        await onNuevo(
          nombre.trim(),
          esSerializado ? costoPromedioNuevos : precio,
          esSerializado ? unidadesFinal.length : cantidad,
          categoria ? cat : undefined,
          esSerializado ? unidadesFinal : undefined,
        );
      }
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      accent
      title={locked ? "Reponer stock" : `Agregar / ingresar ${titulo}`}
      description={
        locked
          ? (existenteSel?.label ?? "")
          : "Sumá unidades a un ítem existente o creá uno nuevo."
      }
      footer={
        <>
          <button
            onClick={onClose}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
          >
            Cancelar
          </button>
          <button
            disabled={!valid || pending}
            onClick={submit}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:pointer-events-none disabled:opacity-50"
          >
            {pending
              ? "Guardando…"
              : locked
                ? "Reponer"
                : modo === "existente"
                  ? "Ingresar stock"
                  : "Crear"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {!locked && (
          <div className="flex rounded-lg border border-neutral-200 p-0.5">
            {(["existente", "nuevo"] as const).map((m) => (
              <button
                key={m}
                type="button"
                disabled={m === "existente" && existentes.length === 0}
                onClick={() => setModo(m)}
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors disabled:opacity-40",
                  modo === m
                    ? "bg-accent-soft text-accent"
                    : "text-neutral-500 hover:bg-neutral-50",
                )}
              >
                {m === "existente" ? "Sumar a existente" : "Nuevo"}
              </button>
            ))}
          </div>
        )}

        {modo === "existente" ? (
          <Field label={titulo}>
            {locked ? (
              <div className="flex h-9 items-center rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-700">
                {existenteSel?.label}
                {existenteSel?.serializado ? " (serializado)" : ""}
              </div>
            ) : (
              <Select value={sel} onChange={(e) => setSel(e.target.value)}>
                {existentes.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                    {x.serializado ? " (serializado)" : ""}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : (
          <>
            <Field label="Nombre">
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder={
                  categoria ? "iPad 10ma gen 64GB" : "Pantalla OLED iPhone 14"
                }
              />
            </Field>
            {categoria && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Categoría">
                  <Select
                    value={cat}
                    onChange={(e) => setCat(e.target.value as OtroCategoria)}
                  >
                    {CATS.map((c) => (
                      <option key={c} value={c}>
                        {otroCategoria[c].label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Serializado">
                  <div className="flex h-9 rounded-lg border border-neutral-200 p-0.5">
                    {(["no", "si"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setSerializadoNuevo(v === "si")}
                        className={cn(
                          "flex-1 rounded-md text-[13px] font-medium transition-colors",
                          (v === "si") === serializadoNuevo
                            ? "bg-accent-soft text-accent"
                            : "text-neutral-500 hover:bg-neutral-50",
                        )}
                      >
                        {v === "si" ? "Sí" : "No"}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            )}
          </>
        )}

        {esSerializado ? (
          <div className="space-y-3">
            <div className="flex rounded-lg border border-neutral-200 p-0.5">
              {(["manual", "bulk"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModoCarga(m)}
                  className={cn(
                    "flex-1 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                    modoCarga === m
                      ? "bg-accent-soft text-accent"
                      : "text-neutral-500 hover:bg-neutral-50",
                  )}
                >
                  {m === "manual" ? "Uno por uno" : "Carga en bulk"}
                </button>
              ))}
            </div>

            {modoCarga === "manual" ? (
              <Field label="Unidades">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                    <span className="flex-1">Serial</span>
                    <span className="w-28 text-center">Color</span>
                    <span className="w-24 text-center">Costo</span>
                    <span className="w-9" />
                  </div>
                  {unidadesManual.map((u, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        className="min-w-0 flex-1"
                        value={u.serial}
                        onChange={(e) =>
                          updUnidad(i, { serial: e.target.value })
                        }
                        placeholder={`Serial ${i + 1}`}
                      />
                      <Input
                        className="w-28"
                        value={u.color}
                        onChange={(e) =>
                          updUnidad(i, { color: e.target.value })
                        }
                        placeholder="Color"
                      />
                      <Input
                        className="w-24"
                        type="number"
                        min={0}
                        value={u.costoUsd || ""}
                        placeholder="U$"
                        onChange={(e) =>
                          updUnidad(i, {
                            costoUsd: Number(e.target.value) || 0,
                          })
                        }
                      />
                      <button
                        type="button"
                        onClick={() => rmUnidad(i)}
                        disabled={unidadesManual.length === 1}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-red-500 disabled:opacity-30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addUnidad}
                  className="mt-2 text-xs font-medium text-accent hover:underline"
                >
                  + Agregar unidad
                </button>
              </Field>
            ) : (
              <>
                <Field label="Seriales (uno por línea)">
                  <Textarea
                    rows={4}
                    value={bulkSeriales}
                    onChange={(e) => setBulkSeriales(e.target.value)}
                    placeholder={"IPAD9-010\nIPAD9-011\nIPAD9-012"}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Color (para todos)">
                    <Input
                      value={bulkColor}
                      onChange={(e) => setBulkColor(e.target.value)}
                      placeholder="Opcional"
                    />
                  </Field>
                  <Field label="Costo c/u (U$)">
                    <Input
                      type="number"
                      min={0}
                      value={bulkCosto || ""}
                      onChange={(e) =>
                        setBulkCosto(Number(e.target.value) || 0)
                      }
                    />
                  </Field>
                </div>
                {unidadesFinal.length > 0 && (
                  <p className="text-[11px] text-neutral-400">
                    {unidadesFinal.length} unidad
                    {unidadesFinal.length === 1 ? "" : "es"} detectada
                    {unidadesFinal.length === 1 ? "" : "s"}.
                  </p>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cantidad">
              <Input
                type="number"
                min={1}
                value={cantidad}
                onChange={(e) => setCantidad(Number(e.target.value) || 1)}
              />
            </Field>
            <Field label="Precio compra (U$)">
              <Input
                type="number"
                min={0}
                value={precio || ""}
                onChange={(e) => setPrecio(Number(e.target.value) || 0)}
              />
            </Field>
          </div>
        )}
      </div>
    </Dialog>
  );
}
