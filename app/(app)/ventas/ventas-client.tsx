"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Plus,
  Trash2,
  Check,
  FileText,
  ShieldCheck,
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ChecklistEditor, CHECKLIST_VACIO } from "@/components/ui/checklist-editor";
import {
  ReciboImprimir,
  ReciboLineas,
  ReciboGarantiaItems,
  ReciboNota,
  ReciboNotaLista,
  type ReciboPagina,
} from "@/components/recibos/recibo";
import { medioPago as medioPagoCfg, dotClass, MEDIOS_CAJA } from "@/lib/status";
import { fmtUsd, fmtArs, fmtNum, fmtDateSlash } from "@/lib/format";
import { otroCostoPromedio } from "@/lib/otros";
import {
  calcularMargenPct,
  calcularRestante,
  saldarUltimoPago,
  montoConRecargo,
  categoriaDe,
  RUBRO_LABEL,
} from "@/lib/ventas";
import { useDolar } from "@/lib/dolar";
import { useRealtime } from "@/components/notifications/realtime-provider";
import { cn } from "@/lib/utils";
import { filterPill, thDivider } from "@/lib/ui-styles";
import { DATE_PRESETS, presetRange, type DatePreset } from "@/lib/date-presets";
import type {
  Caja,
  CanjeEquipo,
  Checklist,
  ClienteOpcion,
  ClienteSeleccion,
  Equipo,
  MedioPago,
  MedioPagoVenta,
  ModalidadVenta,
  OtroItem,
  Pago,
  Repuesto,
  Servicio,
  Venta,
  VentaItem,
} from "@/lib/types";
import type { Negocio } from "@/lib/db/configuracion";
import type { SessionUser } from "@/lib/auth/types";
import { ClientePicker } from "@/components/ui/cliente-picker";
import { useOutsideClick } from "@/components/ui/use-outside-click";
import { createVentaAction, deleteVentaAction } from "./actions";

const PROCEDENCIAS = [
  "Local",
  "WhatsApp",
  "Instagram",
  "MercadoLibre",
  "Referido",
  "Otro",
];

const MODALIDAD_LABEL: Record<ModalidadVenta, string> = {
  minorista: "Minorista",
  mayorista: "Mayorista",
};

function ventaCosto(v: Venta) {
  return v.items.reduce((a, i) => a + i.cantidad * (i.costoUsd ?? 0), 0);
}

function ventaGanancia(v: Venta) {
  return v.totalUsd - ventaCosto(v);
}

/** El monto de un pago se guarda siempre en USD; en pantalla, si el medio
 * es "pesos" se muestra convertido a $ a la cotización blue vigente. */
function fmtPago(medio: MedioPagoVenta, montoUsd: number, dolarVenta: number) {
  return medio === "pesos" ? fmtArs(montoUsd * dolarVenta) : fmtUsd(montoUsd);
}

function matchesQuery(v: Venta, q: string, equiposPorId: Map<string, Equipo>) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  if (v.cliente.toLowerCase().includes(needle)) return true;
  return v.items.some((i) => {
    if (i.detalle.toLowerCase().includes(needle)) return true;
    const equipo = i.equipoId ? equiposPorId.get(i.equipoId) : undefined;
    return equipo ? equipo.imei.toLowerCase().includes(needle) : false;
  });
}

type PersonaOpcion = { id: string; nombre: string };

export function VentasClient({
  initialVentas,
  clientesOpciones,
  equipos,
  otros,
  servicios,
  repuestos,
  vendedores,
  cajas,
  negocio,
  user,
}: {
  initialVentas: Venta[];
  clientesOpciones: ClienteOpcion[];
  equipos: Equipo[];
  otros: OtroItem[];
  servicios: Servicio[];
  repuestos: Repuesto[];
  vendedores: PersonaOpcion[];
  cajas: Caja[];
  negocio: Negocio;
  user: SessionUser;
}) {
  const { publish } = useRealtime();
  const dolarVenta = useDolar().venta;
  const esAdmin = user.rol === "admin";
  // Vendedor no ve costo/margen de las ventas -- eso expone el precio de
  // compra del ítem vendido (margen = 1 - costo/precio, con el precio ya
  // visible alcanza para despejarlo).
  const puedeVerCosto = user.rol !== "vendedor";
  const [list, setList] = useState<Venta[]>(initialVentas);
  const [vista, setVista] = useState<"ventas" | "items">("ventas");
  const [vendFilter, setVendFilter] = useState("todos");
  const [tipoFilter, setTipoFilter] = useState<"todos" | "venta" | "reparacion">(
    "todos",
  );
  const [datePreset, setDatePreset] = useState<DatePreset>("todos");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  // Filtros secundarios (vista, vendedor, tipo, fecha) colapsados por
  // default en mobile -- el buscador y "Nueva venta" quedan siempre
  // visibles. Sin efecto desde md (siempre en línea, como antes).
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [restituirEquipos, setRestituirEquipos] = useState(true);
  const [restituirRepuestos, setRestituirRepuestos] = useState(true);
  const [eliminarMovimientosCaja, setEliminarMovimientosCaja] = useState(true);
  const [eliminarMovimientoCC, setEliminarMovimientoCC] = useState(true);
  const [eliminarCompraCanje, setEliminarCompraCanje] = useState(true);
  const [, startTransition] = useTransition();
  const [recibo, setRecibo] = useState<
    | { venta: Venta; tipo: "venta" }
    | { venta: Venta; tipo: "garantia"; item?: VentaItem }
    | null
  >(null);

  const equiposPorId = useMemo(
    () => new Map(equipos.map((e) => [e.id, e])),
    [equipos],
  );

  const clientesPorId = useMemo(
    () => new Map(clientesOpciones.map((c) => [c.id, c])),
    [clientesOpciones],
  );

  const range =
    datePreset === "personalizado"
      ? { desde, hasta }
      : (presetRange(datePreset) ?? { desde: "", hasta: "" });

  const filtered = useMemo(
    () =>
      list.filter(
        (v) =>
          (vendFilter === "todos" || v.vendedor === vendFilter) &&
          (tipoFilter === "todos" || v.tipo === tipoFilter) &&
          (!range.desde || v.fechaISO >= range.desde) &&
          (!range.hasta || v.fechaISO <= range.hasta) &&
          matchesQuery(v, q, equiposPorId),
      ),
    [list, vendFilter, tipoFilter, range.desde, range.hasta, q, equiposPorId],
  );

  const itemRows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return filtered.flatMap((v) =>
      v.items
        .filter((i) => {
          if (!needle) return true;
          if (i.detalle.toLowerCase().includes(needle)) return true;
          const equipo = i.equipoId ? equiposPorId.get(i.equipoId) : undefined;
          return equipo ? equipo.imei.toLowerCase().includes(needle) : false;
        })
        .map((item) => ({ venta: v, item })),
    );
  }, [filtered, q, equiposPorId]);

  const open = list.find((v) => v.id === openId) ?? null;

  function eliminarVenta(venta: Venta) {
    const id = venta.id;
    setList((prev) => prev.filter((v) => v.id !== id));
    setOpenId(null);
    setConfirmDelete(false);
    startTransition(async () => {
      await deleteVentaAction(id, {
        restituirEquipos,
        restituirRepuestos,
        eliminarMovimientosCaja,
        eliminarMovimientoCC,
        eliminarCompraCanje,
      });
    });
    publish({
      type: "item_deleted",
      actor: user.nombre,
      entity: "Venta",
      label: `${id} · ${venta.cliente}`,
    });
  }

  const totalUsd = filtered.reduce((a, v) => a + v.totalUsd, 0);
  const margenProm =
    filtered.length > 0
      ? filtered.reduce((a, v) => a + v.margenPct, 0) / filtered.length
      : 0;

  // Contenido del documento de Garantía -- reusado tanto standalone (botón
  // "Garantía" del detalle de venta / de una fila de "Ítems vendidos") como
  // embebido en "Comprobante de venta" (para poder imprimir todo junto).
  function garantiaContenido(items: VentaItem[]) {
    return (
      <>
        <ReciboGarantiaItems
          items={items.map((i) => ({
            detalle: i.detalle,
            serial: i.equipoId ? equiposPorId.get(i.equipoId)?.imei : undefined,
            garantia: i.equipoId ? negocio.garantiaTexto || "—" : "—",
          }))}
        />
        <ReciboNota titulo="Condiciones de garantía" texto={negocio.garantiaCondiciones} />
        <ReciboNotaLista
          titulo="Causales de anulación de la garantía"
          texto={negocio.garantiaCausales}
        />
        <ReciboNota titulo="Importante" texto={negocio.garantiaImportante} tono="warning" />
      </>
    );
  }

  const paginasVenta: ReciboPagina[] | undefined =
    recibo?.tipo === "venta"
      ? [
          {
            titulo: "Recibo",
            children: (
              <>
                <ReciboLineas
                  titulo="Detalle"
                  forzarTabla
                  lineas={recibo.venta.items.map((i) => ({
                    detalle: i.detalle,
                    cantidad: i.cantidad,
                    montoUsd: i.cantidad * i.precioUsd,
                    serial: i.equipoId ? equiposPorId.get(i.equipoId)?.imei : undefined,
                  }))}
                  total={recibo.venta.totalUsd}
                />
                <ReciboLineas
                  titulo="Forma de pago"
                  lineas={recibo.venta.pagos.map((p) => ({
                    detalle: medioPagoCfg[p.medio].label,
                    montoUsd: p.montoUsd,
                    montoLabel: fmtPago(p.medio, p.montoUsd, dolarVenta),
                  }))}
                />
              </>
            ),
          },
          ...(recibo.venta.items.some((i) => i.equipoId)
            ? [
                {
                  titulo: "Garantía",
                  compacto: true,
                  sello: true,
                  children: garantiaContenido(recibo.venta.items),
                },
              ]
            : []),
        ]
      : undefined;

  const garantiaPagina: ReciboPagina[] | undefined =
    recibo?.tipo === "garantia"
      ? [
          {
            titulo: "Garantía",
            compacto: true,
            sello: true,
            children: garantiaContenido(recibo.item ? [recibo.item] : recibo.venta.items),
          },
        ]
      : undefined;

  return (
    <>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard align="left" label="Operaciones" value={filtered.length} />
          <StatCard align="left" label="Facturado" value={fmtUsd(totalUsd)} />
          {puedeVerCosto ? (
            <StatCard
              align="left"
              label="Margen promedio"
              value={`${margenProm.toFixed(1)}%`}
            />
          ) : (
            <StatCard
              align="left"
              label="Ítems vendidos"
              value={filtered.reduce((a, v) => a + v.items.length, 0)}
            />
          )}
          <StatCard
            align="left"
            label="Ticket promedio"
            value={fmtUsd(filtered.length ? totalUsd / filtered.length : 0)}
          />
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
          <div className="relative w-full md:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por cliente, serie o producto…"
              className={cn("w-full pl-9", filterPill)}
            />
          </div>

          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-neutral-200 px-3.5 text-sm font-medium text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50 md:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
            {filtersOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          <div
            className={cn(
              "flex-col gap-2 md:contents",
              filtersOpen ? "flex" : "hidden",
            )}
          >
            <Tabs
              value={vista}
              onChange={setVista}
              className="w-full justify-between md:w-auto md:justify-start"
              options={[
                { value: "ventas", label: "Ventas", count: filtered.length },
                { value: "items", label: "Ítems vendidos", count: itemRows.length },
              ]}
            />
            <Select
              value={vendFilter}
              onChange={(e) => setVendFilter(e.target.value)}
              className={cn("w-full md:w-44", filterPill)}
            >
              <option value="todos">Todos los vendedores</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.nombre}>
                  {v.nombre}
                </option>
              ))}
            </Select>
            <Select
              value={tipoFilter}
              onChange={(e) => setTipoFilter(e.target.value as typeof tipoFilter)}
              className={cn("w-full md:w-40", filterPill)}
            >
              <option value="todos">Todo</option>
              <option value="venta">Equipos</option>
              <option value="reparacion">Reparaciones</option>
            </Select>
            <Select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value as DatePreset)}
              className={cn("w-full md:w-44", filterPill)}
            >
              {DATE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
            {datePreset === "personalizado" && (
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                  className={cn("w-full md:w-36", filterPill)}
                />
                <span className="text-xs text-neutral-400">a</span>
                <Input
                  type="date"
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                  className={cn("w-full md:w-36", filterPill)}
                />
              </div>
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

          <button
            onClick={() => setCreating(true)}
            className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-accent/40 px-4 text-sm font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft md:ml-auto md:w-auto"
          >
            <Plus className="h-4 w-4" />
            Nueva venta
          </button>
        </div>

        {vista === "items" ? (
          <>
          <div className="space-y-2 md:hidden">
            {itemRows.map(({ venta: v, item: i }, idx) => (
              <Card
                key={`${v.id}-${idx}`}
                onClick={() => setOpenId(v.id)}
                className="cursor-pointer p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-neutral-400">
                    {v.id} · {v.fecha} · {v.cliente}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRecibo({ venta: v, tipo: "garantia", item: i });
                    }}
                    title="Imprimir garantía"
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-neutral-400 hover:bg-accent-soft hover:text-accent"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-1 flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-medium text-neutral-900">
                    {i.detalle}
                  </p>
                  <span className="shrink-0 text-xs text-neutral-500">
                    {RUBRO_LABEL[categoriaDe(i)]}
                  </span>
                </div>
                {i.equipoId && (
                  <p className="mt-0.5 font-mono text-xs text-neutral-400">
                    {equiposPorId.get(i.equipoId)?.imei ?? "—"}
                  </p>
                )}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[11px] uppercase text-neutral-400">Cant.</p>
                    <p className="text-sm tabular-nums">{i.cantidad}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-neutral-400">Precio</p>
                    <p className="text-sm tabular-nums">{fmtUsd(i.precioUsd)}</p>
                  </div>
                  {puedeVerCosto && (
                    <>
                      <div>
                        <p className="text-[11px] uppercase text-neutral-400">Costo</p>
                        <p className="text-sm tabular-nums text-neutral-500">
                          {i.costoUsd !== undefined ? fmtUsd(i.costoUsd) : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase text-neutral-400">Margen</p>
                        <p className="text-sm font-semibold tabular-nums">
                          {i.costoUsd !== undefined
                            ? `${calcularMargenPct(i.precioUsd, i.costoUsd).toFixed(1)}%`
                            : "—"}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </Card>
            ))}
            {itemRows.length === 0 && (
              <p className="rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
                Sin ítems para estos filtros.
              </p>
            )}
          </div>
          <Card className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-xs text-neutral-400">
                  <th className={cn("px-5 py-3 text-center", thDivider)}>Venta</th>
                  <th className={cn("px-5 py-3 text-center", thDivider)}>Cliente</th>
                  <th className={cn("px-5 py-3 text-center", thDivider)}>Ítem</th>
                  <th className={cn("px-5 py-3 text-center", thDivider)}>Serie</th>
                  <th className={cn("px-5 py-3 text-center", thDivider)}>Precio</th>
                  {puedeVerCosto && (
                    <th className={cn("px-5 py-3 text-center", thDivider)}>Costo</th>
                  )}
                  {puedeVerCosto && (
                    <th className={cn("px-5 py-3 text-center", thDivider)}>Margen</th>
                  )}
                  <th className="px-5 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {itemRows.map(({ venta: v, item: i }, idx) => (
                  <tr
                    key={`${v.id}-${idx}`}
                    onClick={() => setOpenId(v.id)}
                    className="cursor-pointer border-t border-neutral-100 first:border-t-0 hover:bg-neutral-50"
                  >
                    <td className="px-5 py-2 text-center font-medium text-neutral-500">
                      {v.id}
                      <span className="block text-xs font-normal text-neutral-400">
                        {v.fecha}
                      </span>
                    </td>
                    <td className="max-w-[140px] truncate px-5 py-2 text-center">
                      {v.cliente}
                    </td>
                    <td className="max-w-[260px] truncate px-5 py-2 text-center">
                      {i.detalle}
                    </td>
                    <td className="px-5 py-2 text-center font-mono text-xs tabular-nums text-neutral-500">
                      {i.equipoId ? (equiposPorId.get(i.equipoId)?.imei ?? "—") : "—"}
                    </td>
                    <td className="px-5 py-2 text-center tabular-nums">
                      {fmtUsd(i.precioUsd)}
                    </td>
                    {puedeVerCosto && (
                      <td className="px-5 py-2 text-center tabular-nums text-neutral-500">
                        {i.costoUsd !== undefined ? fmtUsd(i.costoUsd) : "—"}
                      </td>
                    )}
                    {puedeVerCosto && (
                      <td className="px-5 py-2 text-center tabular-nums font-semibold">
                        {i.costoUsd !== undefined
                          ? `${calcularMargenPct(i.precioUsd, i.costoUsd).toFixed(1)}%`
                          : "—"}
                      </td>
                    )}
                    <td className="px-5 py-2 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRecibo({ venta: v, tipo: "garantia", item: i });
                        }}
                        title="Imprimir garantía"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-accent-soft hover:text-accent"
                      >
                        <ShieldCheck className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {itemRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={puedeVerCosto ? 8 : 6}
                      className="px-5 py-10 text-center text-sm text-neutral-400"
                    >
                      Sin ítems para estos filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
          </>
        ) : (
        <>
        <div className="space-y-2 md:hidden">
          {filtered.map((v) => (
            <VentaCardMobile
              key={v.id}
              venta={v}
              dolarVenta={dolarVenta}
              onOpen={() => setOpenId(v.id)}
              onRecibo={() => setRecibo({ venta: v, tipo: "venta" })}
              onGarantia={() => setRecibo({ venta: v, tipo: "garantia" })}
              puedeVerCosto={puedeVerCosto}
            />
          ))}
          {filtered.length === 0 && (
            <p className="rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
              Sin ventas para estos filtros.
            </p>
          )}
        </div>
        <Card className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-xs text-neutral-400">
                <th className={cn("px-5 py-3 text-center", thDivider)}>Venta</th>
                <th className={cn("px-5 py-3 text-center", thDivider)}>Cliente</th>
                <th className={cn("px-5 py-3 text-center", thDivider)}>Detalle</th>
                <th className={cn("px-5 py-3 text-center", thDivider)}>Pago</th>
                {puedeVerCosto && (
                  <th className={cn("px-5 py-3 text-center", thDivider)}>Costo</th>
                )}
                {puedeVerCosto && (
                  <th className={cn("px-5 py-3 text-center", thDivider)}>Margen</th>
                )}
                <th className={cn("px-5 py-3 text-center", thDivider)}>Total</th>
                <th className="px-5 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr
                  key={v.id}
                  onClick={() => setOpenId(v.id)}
                  className="cursor-pointer border-t border-neutral-100 first:border-t-0 hover:bg-neutral-50"
                >
                  <td className="px-5 py-2 text-center font-medium text-neutral-500">
                    {v.id}
                    <span className="block text-xs font-normal text-neutral-400">
                      {v.fecha}
                    </span>
                  </td>
                  <td className="max-w-[140px] truncate px-5 py-2 text-center">
                    {v.cliente}
                  </td>
                  <td className="max-w-[260px] truncate px-5 py-2 text-center text-neutral-500">
                    {v.items.map((i) => i.detalle).join(" · ")}
                  </td>
                  <td className="px-5 py-2">
                    <div className="flex flex-col items-center gap-1">
                      {(v.pagos.length > 3 ? v.pagos.slice(0, 2) : v.pagos).map(
                        (p, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700"
                          >
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                dotClass[medioPagoCfg[p.medio].tone],
                              )}
                            />
                            {medioPagoCfg[p.medio].label}
                            <span className="font-normal tabular-nums text-neutral-900">
                              {fmtPago(p.medio, p.montoUsd, dolarVenta)}
                            </span>
                          </span>
                        ),
                      )}
                      {v.pagos.length > 3 && (
                        <span className="text-[11px] text-neutral-400">…</span>
                      )}
                    </div>
                  </td>
                  {puedeVerCosto && (
                    <td className="px-5 py-2 text-center tabular-nums text-neutral-500">
                      {fmtUsd(ventaCosto(v))}
                    </td>
                  )}
                  {puedeVerCosto && (
                    <td className="px-5 py-2 text-center tabular-nums text-neutral-500">
                      {v.margenPct.toFixed(1)}%
                    </td>
                  )}
                  <td className="px-5 py-2 text-center font-semibold tabular-nums">
                    {fmtUsd(v.totalUsd)}
                  </td>
                  <td className="px-5 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRecibo({ venta: v, tipo: "venta" });
                        }}
                        title="Imprimir recibo"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-accent-soft hover:text-accent"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRecibo({ venta: v, tipo: "garantia" });
                        }}
                        title="Imprimir garantía"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-accent-soft hover:text-accent"
                      >
                        <ShieldCheck className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={puedeVerCosto ? 8 : 6}
                    className="px-5 py-10 text-center text-sm text-neutral-400"
                  >
                    Sin ventas para estos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
        </>
        )}
      </div>

      <NuevaVentaDialog
        key={creating ? "abierto" : "cerrado"}
        open={creating}
        onClose={() => setCreating(false)}
        clientesOpciones={clientesOpciones}
        equipos={equipos}
        otros={otros}
        servicios={servicios}
        repuestos={repuestos}
        vendedores={vendedores}
        cajas={cajas}
        negocio={negocio}
        dolarVenta={dolarVenta}
        onCreate={(v) => {
          setList((prev) => [v, ...prev]);
          setCreating(false);
          publish({
            type: "sale_confirmed",
            actor: v.vendedor,
            amountUsd: v.totalUsd,
            ref: v.id,
            cliente: v.cliente,
          });
        }}
      />

      <Dialog
        open={!!open}
        onClose={() => setOpenId(null)}
        size="lg"
        accent
        title={open ? `Venta ${open.id}` : ""}
        description={open ? open.fecha : ""}
        footer={
          open && (
            <>
              {esAdmin && (
                <button
                  onClick={() => {
                    setRestituirEquipos(true);
                    setRestituirRepuestos(true);
                    setEliminarMovimientosCaja(true);
                    setEliminarMovimientoCC(true);
                    setEliminarCompraCanje(true);
                    setConfirmDelete(true);
                  }}
                  className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-red-200 px-4 text-sm font-semibold text-red-600 transition-colors hover:border-red-300 hover:bg-red-50 sm:mr-auto sm:w-auto"
                >
                  <Trash2 className="h-4 w-4" /> Eliminar venta
                </button>
              )}
              <button
                onClick={() => setOpenId(null)}
                className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50 sm:w-auto"
              >
                Cerrar
              </button>
              {open.pagos
                .filter((p) => p.medio === "canje" && p.compraId)
                .map((p) => (
                  <a
                    key={p.compraId}
                    href={`/compras?open=${p.compraId}`}
                    className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-accent/40 px-4 text-sm font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft sm:w-auto"
                  >
                    <FileText className="h-4 w-4" /> Ver compra de canje {p.compraId}
                  </a>
                ))}
              <button
                onClick={() => setRecibo({ venta: open, tipo: "garantia" })}
                className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-accent/40 px-4 text-sm font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft sm:w-auto"
              >
                <ShieldCheck className="h-4 w-4" /> Garantía
              </button>
              <button
                onClick={() => setRecibo({ venta: open, tipo: "venta" })}
                className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-accent/40 px-4 text-sm font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft sm:w-auto"
              >
                <FileText className="h-4 w-4" /> Comprobante de venta
              </button>
            </>
          )
        }
      >
        {open && <VentaDetalle venta={open} puedeVerCosto={puedeVerCosto} />}
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => open && eliminarVenta(open)}
        title="¿Eliminar venta?"
        confirmLabel="Eliminar venta"
      >
        {open && (
          <>
            <p>
              Se eliminará la venta {open.id} de {open.cliente}. Esta acción
              no se puede deshacer.
            </p>
            {open.items.some((i) => i.equipoId) && (
              <label className="flex items-start gap-2 rounded-lg border border-neutral-200 p-3 text-[13px] font-medium text-neutral-700">
                <input
                  type="checkbox"
                  checked={restituirEquipos}
                  onChange={(e) => setRestituirEquipos(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-accent focus:ring-accent"
                />
                Devolver los equipos vendidos al inventario (quedan
                «disponibles» de nuevo)
              </label>
            )}
            {open.items.some((i) => i.repuestos?.length) && (
              <label className="flex items-start gap-2 rounded-lg border border-neutral-200 p-3 text-[13px] font-medium text-neutral-700">
                <input
                  type="checkbox"
                  checked={restituirRepuestos}
                  onChange={(e) => setRestituirRepuestos(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-accent focus:ring-accent"
                />
                Devolver los repuestos usados al stock
              </label>
            )}
            {open.tieneMovimientoCaja && (
              <label className="flex items-start gap-2 rounded-lg border border-neutral-200 p-3 text-[13px] font-medium text-neutral-700">
                <input
                  type="checkbox"
                  checked={eliminarMovimientosCaja}
                  onChange={(e) => setEliminarMovimientosCaja(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-accent focus:ring-accent"
                />
                Eliminar también los movimientos de caja generados por esta
                venta
              </label>
            )}
            {open.tieneMovimientoCC && (
              <label className="flex items-start gap-2 rounded-lg border border-neutral-200 p-3 text-[13px] font-medium text-neutral-700">
                <input
                  type="checkbox"
                  checked={eliminarMovimientoCC}
                  onChange={(e) => setEliminarMovimientoCC(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-accent focus:ring-accent"
                />
                Eliminar también el movimiento de cuenta corriente generado
                por esta venta
              </label>
            )}
            {open.pagos.some((p) => p.medio === "canje" && p.compraId) && (
              <label className="flex items-start gap-2 rounded-lg border border-neutral-200 p-3 text-[13px] font-medium text-neutral-700">
                <input
                  type="checkbox"
                  checked={eliminarCompraCanje}
                  onChange={(e) => setEliminarCompraCanje(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-accent focus:ring-accent"
                />
                Eliminar también la compra de canje generada por esta venta
              </label>
            )}
          </>
        )}
      </ConfirmDialog>

      <ReciboImprimir
        key={
          recibo
            ? `${recibo.tipo}-${recibo.venta.id}-${
                recibo.tipo === "garantia" ? (recibo.item?.equipoId ?? "full") : ""
              }`
            : "none"
        }
        open={!!recibo}
        onClose={() => setRecibo(null)}
        titulo={recibo?.tipo === "garantia" ? "Garantía" : "Recibo"}
        nro={recibo?.venta.id ?? ""}
        fecha={recibo ? fmtDateSlash(recibo.venta.fechaISO) : ""}
        cliente={recibo?.venta.cliente ?? ""}
        clienteTelefono={recibo ? clientesPorId.get(recibo.venta.clienteId)?.telefono : undefined}
        clienteEmail={recibo ? clientesPorId.get(recibo.venta.clienteId)?.email : undefined}
        negocio={negocio}
        paginas={recibo?.tipo === "garantia" ? garantiaPagina : paginasVenta}
      />
    </>
  );
}

// ────────────────────── Tarjeta de venta (mobile) ──────────────────────

/** Tarjeta de la lista de Ventas en mobile. Con más de un método de pago el
 * bloque de abajo (Costo/Margen/pago) no entra en una línea -- en vez de
 * dejar que la tarjeta se estire con el wrap automático, arranca colapsada
 * (1 método) con un "Ver más" que revela el resto a pedido. */
function VentaCardMobile({
  venta: v,
  dolarVenta,
  onOpen,
  onRecibo,
  onGarantia,
  puedeVerCosto,
}: {
  venta: Venta;
  dolarVenta: number;
  onOpen: () => void;
  onRecibo: () => void;
  onGarantia: () => void;
  puedeVerCosto: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const pagosVisibles = expanded ? v.pagos : v.pagos.slice(0, 1);
  const ocultos = v.pagos.length - pagosVisibles.length;

  return (
    <Card onClick={onOpen} className="cursor-pointer overflow-hidden p-0">
      <div className="flex items-center justify-between gap-2 bg-table-header px-4 py-2 text-white">
        <span className="text-sm font-semibold">{v.id}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/70">{v.fecha}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRecibo();
            }}
            title="Imprimir recibo"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-white/70 hover:bg-white/10 hover:text-white"
          >
            <FileText className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onGarantia();
            }}
            title="Imprimir garantía"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-white/70 hover:bg-white/10 hover:text-white"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex items-stretch gap-3 p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-neutral-900">{v.cliente}</p>
          <p className="mt-0.5 truncate text-xs text-neutral-500">
            {v.items.map((i) => i.detalle).join(" · ")}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-2.5 text-[11px] text-neutral-400">
            {puedeVerCosto && (
              <>
                <span>Costo {fmtUsd(ventaCosto(v))}</span>
                <span>Margen {v.margenPct.toFixed(1)}%</span>
              </>
            )}
            <div className="flex flex-wrap items-center gap-1">
              {pagosVisibles.map((p, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700"
                >
                  <span
                    className={cn("h-1.5 w-1.5 rounded-full", dotClass[medioPagoCfg[p.medio].tone])}
                  />
                  {medioPagoCfg[p.medio].label}
                  <span className="font-normal tabular-nums text-neutral-900">
                    {fmtPago(p.medio, p.montoUsd, dolarVenta)}
                  </span>
                </span>
              ))}
              {ocultos > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpanded(true);
                  }}
                  className="text-[11px] font-semibold text-accent"
                >
                  Ver más (+{ocultos})
                </button>
              )}
              {expanded && v.pagos.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpanded(false);
                  }}
                  className="text-[11px] font-semibold text-accent"
                >
                  Ver menos
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center border-l border-neutral-100 pl-3">
          <p className="text-base font-semibold tabular-nums">{fmtUsd(v.totalUsd)}</p>
        </div>
      </div>
    </Card>
  );
}

// ────────────────────── Detalle de venta ──────────────────────

function VentaDetalle({
  venta,
  puedeVerCosto,
}: {
  venta: Venta;
  puedeVerCosto: boolean;
}) {
  const dolarVenta = useDolar().venta;
  const metaFields: { label: string; value: string }[] = [
    { label: "Cliente", value: venta.cliente },
    { label: "Vendedor", value: venta.vendedor },
    ...(venta.procedencia
      ? [{ label: "Procedencia", value: venta.procedencia }]
      : []),
    { label: "Modalidad", value: MODALIDAD_LABEL[venta.modalidad] },
    {
      label: "Tipo",
      value:
        venta.tipo === "venta" ? "Venta de equipos" : "Reparación / servicio",
    },
  ];
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 border-b border-neutral-200 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
          Información general
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {metaFields.map((f, idx) => (
            <Card
              key={f.label}
              className={cn(
                "p-2 text-center",
                // Con cantidad impar de campos (sin "Procedencia"), el último
                // queda solo en la 2da fila con medio card de hueco al lado
                // -- ocupa las 2 columnas en mobile; en sm+ vuelve a 1.
                idx === metaFields.length - 1 &&
                  metaFields.length % 2 === 1 &&
                  "col-span-2 sm:col-span-1",
              )}
            >
              <p className="font-grotesk truncate border-b border-neutral-300 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                {f.label}
              </p>
              <p className="mt-1.5 truncate text-sm font-normal text-neutral-600">
                {f.value}
              </p>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 border-b border-neutral-200 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
          Ítems
        </p>
        <Card className="divide-y divide-neutral-100 overflow-hidden md:hidden">
          {venta.items.map((i, idx) => (
            <div key={idx} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm text-neutral-900">
                {i.detalle}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-neutral-400">
                ×{i.cantidad}
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {fmtUsd(i.cantidad * i.precioUsd)}
              </span>
            </div>
          ))}
          <div
            className="flex items-center justify-between gap-2 px-3 py-2"
            style={{ backgroundColor: "var(--accent-soft)" }}
          >
            <span className="text-sm font-semibold uppercase tracking-wide text-neutral-900">
              Total
            </span>
            <span className="text-sm font-semibold tabular-nums">{fmtUsd(venta.totalUsd)}</span>
          </div>
        </Card>
        <div className="hidden overflow-hidden rounded-xl border border-neutral-200 md:block">
          <table className="w-full text-sm [&_td]:text-center [&_th]:text-center">
            <thead>
              <tr className="border-b border-neutral-100 text-xs text-neutral-400">
                <th className={cn("px-4 py-2 !text-start", thDivider)}>
                  Detalle
                </th>
                <th className={cn("px-4 py-2", thDivider)}>Cant</th>
                {puedeVerCosto && <th className={cn("px-4 py-2", thDivider)}>Costo</th>}
                <th className={cn("px-4 py-2", thDivider)}>Precio</th>
                <th className="px-4 py-2">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {venta.items.map((i, idx) => (
                <tr
                  key={idx}
                  className="border-t border-neutral-100 first:border-t-0"
                >
                  <td className="px-4 py-2.5 !text-start">{i.detalle}</td>
                  <td className="px-4 py-2.5 tabular-nums">{i.cantidad}</td>
                  {puedeVerCosto && (
                    <td className="px-4 py-2.5 tabular-nums text-neutral-500">
                      {fmtUsd(i.costoUsd ?? 0)}
                    </td>
                  )}
                  <td className="px-4 py-2.5 tabular-nums">
                    {fmtUsd(i.precioUsd)}
                  </td>
                  <td className="px-4 py-2.5 font-semibold tabular-nums">
                    {fmtUsd(i.cantidad * i.precioUsd)}
                  </td>
                </tr>
              ))}
              <tr
                className="border-t border-neutral-100 font-semibold text-neutral-900"
                style={{ backgroundColor: "var(--accent-soft)", backgroundImage: "none" }}
              >
                <td
                  className="px-4 py-2.5 !text-start uppercase tracking-wide"
                  colSpan={puedeVerCosto ? 4 : 3}
                >
                  Total
                </td>
                <td className="px-4 py-2.5 tabular-nums">
                  {fmtUsd(venta.totalUsd)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <p className="mb-1.5 border-b border-neutral-200 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
          Resumen financiero
        </p>
        <div className="grid grid-cols-4 gap-2">
          {venta.pagos.map((p, i) => (
            <Card key={i} className="flex flex-col p-2 text-center" title={`Caja ${p.caja.toUpperCase()}`}>
              <p className="font-grotesk truncate border-b border-neutral-300 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                Método {i + 1}
              </p>
              <div className="flex flex-1 flex-col items-center justify-center gap-1 pt-1.5">
                <p className="truncate text-xs font-normal tabular-nums text-neutral-600">
                  {fmtPago(p.medio, p.montoUsd, dolarVenta)}
                </p>
                <span className="inline-flex max-w-full items-center gap-1 truncate rounded-md bg-neutral-100 px-1.5 py-0.5 text-[9px] font-medium text-neutral-700">
                  <span
                    className={cn(
                      "h-1 w-1 shrink-0 rounded-full",
                      dotClass[medioPagoCfg[p.medio].tone],
                    )}
                  />
                  {medioPagoCfg[p.medio].label}
                </span>
              </div>
            </Card>
          ))}
          {puedeVerCosto && (
            <Card className="flex flex-col p-2 text-center">
              <p className="font-grotesk truncate border-b border-neutral-300 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                Costo total
              </p>
              <div className="flex flex-1 items-center justify-center pt-1.5">
                <p className="truncate text-xs font-normal text-neutral-600">
                  {fmtUsd(ventaCosto(venta))}
                </p>
              </div>
            </Card>
          )}
          {puedeVerCosto && (
            <Card className="flex flex-col p-2 text-center">
              <p className="font-grotesk truncate border-b border-neutral-300 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                Ganancia bruta
              </p>
              <div className="flex flex-1 items-center justify-center pt-1.5">
                <p className="truncate text-xs font-normal tabular-nums text-neutral-600">
                  {fmtUsd(ventaGanancia(venta))}
                </p>
              </div>
            </Card>
          )}
          {puedeVerCosto && (
            <Card className="flex flex-col p-2 text-center">
              <p className="font-grotesk truncate border-b border-neutral-300 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                Margen
              </p>
              <div className="flex flex-1 items-center justify-center pt-1.5">
                <p className="truncate text-xs font-normal text-neutral-600">
                  {venta.margenPct.toFixed(1)}%
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── Nueva venta ───────────────────────────

const rid = () => Math.random().toString(36).slice(2);

type Origen = "equipo" | "otro" | "servicio" | "libre";
type DraftItem = VentaItem & { _k: string; origen: Origen };
type DraftPago = Pago & { _k: string; canje?: CanjeEquipo };

type CatItem = {
  key: string;
  origen: Exclude<Origen, "libre">;
  refId: string;
  nombre: string;
  costoUsd: number;
  precioUsd: number;
  /** Serial/IMEI -- solo los ítems `origen: "equipo"` lo traen. */
  serial?: string;
};

const origenTone: Record<Origen, "violet" | "blue" | "green" | "gray"> = {
  equipo: "violet",
  otro: "blue",
  servicio: "green",
  libre: "gray",
};
const origenLabel: Record<Origen, string> = {
  equipo: "Equipo",
  otro: "Producto",
  servicio: "Servicio",
  libre: "Libre",
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 border-b border-neutral-200 pb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
      {children}
    </p>
  );
}

// ── Buscador de ítems ──────────────────────────────────────────

function ItemBuscador({
  equipos,
  otros,
  servicios,
  yaAgregados,
  onAdd,
  onLibre,
}: {
  equipos: Equipo[];
  otros: OtroItem[];
  servicios: Servicio[];
  yaAgregados: string[];
  onAdd: (c: CatItem) => void;
  onLibre: (nombre: string) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useOutsideClick<HTMLDivElement>(() => setOpen(false));

  const catalogo: CatItem[] = useMemo(
    () => [
      ...equipos
        .filter((e) => e.estado === "disponible")
        .map((e) => ({
          key: `e-${e.id}`,
          origen: "equipo" as const,
          refId: e.id,
          nombre: `${e.modelo} ${e.almacenamiento} ${e.color}`,
          costoUsd: e.costoUsd,
          precioUsd: e.precioUsd,
          serial: e.imei,
        })),
      ...otros.map((o) => ({
        key: `o-${o.id}`,
        origen: "otro" as const,
        refId: o.id,
        nombre: o.nombre,
        costoUsd: otroCostoPromedio(o),
        precioUsd: o.precioUsd,
      })),
      ...servicios
        .filter((s) => s.activo)
        .map((s) => ({
          key: `s-${s.id}`,
          origen: "servicio" as const,
          refId: s.id,
          nombre: s.nombre,
          costoUsd: 0,
          precioUsd: s.precioUsd,
        })),
    ],
    [equipos, otros, servicios],
  );

  const matches = catalogo.filter((c) => {
    const needle = q.trim().toLowerCase();
    const coincide =
      c.nombre.toLowerCase().includes(needle) ||
      (c.serial?.toLowerCase().includes(needle) ?? false);
    return coincide && !(c.origen === "equipo" && yaAgregados.includes(c.refId));
  });

  return (
    <div ref={ref} className="relative">
      <Input
        placeholder="Buscar por nombre, color o IMEI/serial…"
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-lg">
          {matches.slice(0, 8).map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => {
                onAdd(c);
                setQ("");
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] hover:bg-neutral-50"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Badge tone={origenTone[c.origen]}>{origenLabel[c.origen]}</Badge>
                <span className="truncate">{c.nombre}</span>
                {c.serial && c.serial !== "—" && (
                  <span className="shrink-0 text-[11px] text-neutral-400">{c.serial}</span>
                )}
              </span>
              <span className="shrink-0 font-semibold text-neutral-500">
                {fmtUsd(c.precioUsd)}
              </span>
            </button>
          ))}
          {matches.length === 0 && (
            <p className="px-3 py-2 text-[13px] text-neutral-400">
              Sin coincidencias en el catálogo.
            </p>
          )}
          {q.trim() && (
            <button
              type="button"
              onClick={() => {
                onLibre(q.trim());
                setQ("");
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 border-t border-neutral-100 px-3 py-2 text-left text-[13px] font-medium text-accent hover:bg-accent-soft"
            >
              <Plus className="h-3.5 w-3.5" /> Ítem libre: «{q.trim()}»
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Dialog ─────────────────────────────────────────────────────

function NuevaVentaDialog({
  open,
  onClose,
  onCreate,
  clientesOpciones,
  equipos,
  otros,
  servicios,
  repuestos,
  vendedores,
  cajas,
  negocio,
  dolarVenta,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (v: Venta) => void;
  clientesOpciones: ClienteOpcion[];
  equipos: Equipo[];
  otros: OtroItem[];
  servicios: Servicio[];
  repuestos: Repuesto[];
  vendedores: PersonaOpcion[];
  cajas: Caja[];
  negocio: Negocio;
  dolarVenta: number;
}) {
  const [cliente, setCliente] = useState<ClienteSeleccion | null>(null);

  const [vendedorId, setVendedorId] = useState(vendedores[0]?.id ?? "");
  const [procedencia, setProcedencia] = useState(PROCEDENCIAS[0]);
  const [modalidad, setModalidad] = useState<ModalidadVenta>("minorista");

  const cajasActivas = cajas.filter((c) => c.activa);
  const destinoPago = (destino: string): Partial<DraftPago> => {
    if (destino === "cuenta_corriente") {
      return {
        medio: "cuenta_corriente",
        cajaId: undefined,
        caja: "usd",
        recargoPct: negocio.recargosMediosPago.cuenta_corriente,
      };
    }
    const caja = cajasActivas.find((c) => c.id === destino);
    return {
      medio: caja?.medioPago ?? "transferencia",
      cajaId: caja?.id,
      caja: caja?.moneda ?? "usd",
      recargoPct: caja ? negocio.recargosMediosPago[caja.medioPago] : undefined,
    };
  };
  const destinoDe = (p: DraftPago) => p.cajaId ?? p.medio;

  // Selector de pago en dos pasos: primero el medio, después -- solo si
  // hay más de una caja activa para ese medio -- cuál caja específica.
  const cajasDeMedio = (medio: MedioPago) =>
    cajasActivas.filter((c) => c.medioPago === medio);
  const mediosDisponibles = MEDIOS_CAJA.filter((m) => cajasDeMedio(m).length > 0);
  const medioAPago = (medio: MedioPagoVenta): Partial<DraftPago> => {
    if (medio === "cuenta_corriente") {
      return {
        medio,
        cajaId: undefined,
        caja: "usd",
        recargoPct: negocio.recargosMediosPago.cuenta_corriente,
      };
    }
    const caja = cajasDeMedio(medio)[0];
    return {
      medio,
      cajaId: caja?.id,
      caja: caja?.moneda ?? "usd",
      recargoPct: negocio.recargosMediosPago[medio],
    };
  };

  const [items, setItems] = useState<DraftItem[]>([]);
  const [pagos, setPagos] = useState<DraftPago[]>([
    {
      _k: rid(),
      ...destinoPago(cajasActivas[0]?.id ?? "cuenta_corriente"),
      montoUsd: 0,
    } as DraftPago,
  ]);
  const [canjeModalKey, setCanjeModalKey] = useState<string | null>(null);
  const [confirmMonto, setConfirmMonto] = useState(false);
  const [pending, startTransition] = useTransition();

  const totalPrecio = items.reduce((a, i) => a + i.cantidad * i.precioUsd, 0);
  const totalCosto = items.reduce(
    (a, i) => a + i.cantidad * (i.costoUsd ?? 0),
    0,
  );
  const margenPct = calcularMargenPct(totalPrecio, totalCosto);
  const restante = calcularRestante(totalPrecio, pagos);

  const clienteNombre = cliente?.nombre ?? "";

  // El monto de cada pago se escribe a mano -- no se auto-completa al
  // agregar ítems (era confuso: el vendedor no sabía si ese número lo
  // había escrito él o lo puso la app). Si al confirmar no coincide con
  // el total, `confirmMonto` pide una confirmación aparte en vez de
  // bloquear el botón -- puede ser una diferencia real (redondeo,
  // descuento de último momento) y no un error de tipeo.
  const valid =
    totalPrecio > 0 &&
    items.every((i) => i.detalle.trim() && i.precioUsd > 0) &&
    clienteNombre.length > 0 &&
    pagos.every((p) => p.montoUsd > 0) &&
    pagos.every((p) => p.medio !== "canje" || p.canje?.equipo.trim());

  function addCatalogo(c: CatItem) {
    setItems((p) => [
      ...p,
      {
        _k: rid(),
        origen: c.origen,
        equipoId: c.origen === "equipo" ? c.refId : undefined,
        detalle: c.nombre,
        cantidad: 1,
        costoUsd: c.costoUsd,
        precioUsd: c.precioUsd,
      },
    ]);
  }
  function addLibre(nombre: string) {
    setItems((p) => [
      ...p,
      {
        _k: rid(),
        origen: "libre",
        detalle: nombre,
        cantidad: 1,
        costoUsd: 0,
        precioUsd: 0,
      },
    ]);
  }
  const updItem = (k: string, patch: Partial<DraftItem>) =>
    setItems((p) => p.map((i) => (i._k === k ? { ...i, ...patch } : i)));
  const rmItem = (k: string) => setItems((p) => p.filter((i) => i._k !== k));

  // Repuestos usados por un ítem de servicio (reparación) -- solo tiene
  // sentido ahí, descuentan stock al confirmar la venta.
  const addRepuestoUsado = (itemKey: string, repuestoId: string) => {
    const r = repuestos.find((x) => x.id === repuestoId);
    if (!r) return;
    setItems((p) =>
      p.map((i) =>
        i._k === itemKey
          ? {
              ...i,
              repuestos: [
                ...(i.repuestos ?? []),
                { repuestoId: r.id, nombre: r.nombre, cantidad: 1 },
              ],
            }
          : i,
      ),
    );
  };
  const updRepuestoUsado = (itemKey: string, idx: number, cantidad: number) =>
    setItems((p) =>
      p.map((i) =>
        i._k === itemKey
          ? {
              ...i,
              repuestos: (i.repuestos ?? []).map((r, j) =>
                j === idx ? { ...r, cantidad } : r,
              ),
            }
          : i,
      ),
    );
  const rmRepuestoUsado = (itemKey: string, idx: number) =>
    setItems((p) =>
      p.map((i) =>
        i._k === itemKey
          ? { ...i, repuestos: (i.repuestos ?? []).filter((_, j) => j !== idx) }
          : i,
      ),
    );

  const destinos = ["cuenta_corriente", ...cajasActivas.map((c) => c.id)];
  const updPago = (k: string, patch: Partial<DraftPago>) =>
    setPagos((p) => p.map((x) => (x._k === k ? { ...x, ...patch } : x)));
  const rmPago = (k: string) =>
    setPagos((p) => (p.length > 1 ? p.filter((x) => x._k !== k) : p));
  const addPago = () =>
    setPagos((p) => {
      const usados = p.map(destinoDe);
      const destino = destinos.find((d) => !usados.includes(d)) ?? destinos[0];
      return [
        ...p,
        {
          _k: rid(),
          ...destinoPago(destino),
          montoUsd: restante > 0 ? restante : 0,
        } as DraftPago,
      ];
    });
  const saldar = () => setPagos((p) => saldarUltimoPago(p, restante));

  function submit() {
    if (!cliente || cliente.tipo === "libre") return;
    startTransition(async () => {
      const vendedorNombre =
        vendedores.find((v) => v.id === vendedorId)?.nombre ?? "";
      const venta = await createVentaAction({
        cliente,
        vendedorId,
        vendedorNombre,
        procedencia,
        modalidad,
        items: items.map(({ _k, origen, ...i }) => ({ ...i, categoria: origen })),
        totalUsd: totalPrecio,
        pagos: pagos.map(({ _k, ...p }) => p),
        margenPct: Math.round(margenPct * 10) / 10,
        tipo: items.some((i) => i.origen === "equipo") ? "venta" : "reparacion",
        dolarVenta,
      });
      onCreate({ ...venta, vendedor: vendedorNombre || venta.vendedor });
    });
  }

  function confirmarClick() {
    if (Math.abs(restante) < 0.005) {
      submit();
    } else {
      setConfirmMonto(true);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="xl"
      accent
      title="Nueva venta"
      description="El número de venta se asigna al confirmar"
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
            onClick={confirmarClick}
            className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
          >
            {pending ? "Confirmando…" : `Confirmar venta · ${fmtUsd(totalPrecio)}`}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Cliente */}
        <Card className="p-4">
          <Eyebrow>Cliente</Eyebrow>
          <ClientePicker clientes={clientesOpciones} value={cliente} onChange={setCliente} />
        </Card>

        {/* Vendedor + Procedencia + Modalidad */}
        <Card className="p-4">
          <Eyebrow>Datos de la venta</Eyebrow>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Vendedor" labelClassName="text-center">
              <Select
                value={vendedorId}
                onChange={(e) => setVendedorId(e.target.value)}
                className="text-center"
              >
                {vendedores.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nombre}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Procedencia" labelClassName="text-center">
              <Select
                value={procedencia}
                onChange={(e) => setProcedencia(e.target.value)}
                className="text-center"
              >
                {PROCEDENCIAS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </Select>
            </Field>
            <Field label="Modalidad" labelClassName="text-center">
              <Select
                value={modalidad}
                onChange={(e) => setModalidad(e.target.value as ModalidadVenta)}
                className="text-center"
              >
                {(Object.keys(MODALIDAD_LABEL) as ModalidadVenta[]).map((m) => (
                  <option key={m} value={m}>
                    {MODALIDAD_LABEL[m]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        {/* Ítems */}
        <Card className="p-4">
          <Eyebrow>Ítems</Eyebrow>

          <ItemBuscador
            equipos={equipos}
            otros={otros}
            servicios={servicios}
            yaAgregados={items
              .map((i) => i.equipoId)
              .filter((x): x is string => !!x)}
            onAdd={addCatalogo}
            onLibre={addLibre}
          />

          {items.length === 0 ? (
            <p className="mt-2 rounded-lg border border-dashed border-neutral-200 px-3 py-4 text-center text-[13px] text-neutral-400">
              Buscá arriba cualquier equipo, producto o servicio por su nombre.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              <div className="hidden items-center gap-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400 sm:flex">
                <span className="flex-1 text-start">Ítem</span>
                <span className="w-12 text-center">Cant</span>
                <span className="w-24 text-center">Precio</span>
                <span className="w-9" />
              </div>
              {items.map((it) => (
                <div key={it._k}>
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                    <Input
                      className="min-w-0 sm:flex-1"
                      placeholder="Nombre del ítem"
                      value={it.detalle}
                      readOnly={it.origen !== "libre"}
                      onChange={(e) =>
                        updItem(it._k, { detalle: e.target.value })
                      }
                    />
                    <div className="flex items-center gap-2">
                      <Input
                        className="w-16 text-center sm:w-12"
                        type="number"
                        min={1}
                        value={it.cantidad}
                        onChange={(e) =>
                          updItem(it._k, { cantidad: Number(e.target.value) || 1 })
                        }
                      />
                      <Input
                        className="flex-1 text-center sm:w-24 sm:flex-none"
                        type="number"
                        min={0}
                        placeholder="U$"
                        value={it.precioUsd || ""}
                        onChange={(e) =>
                          updItem(it._k, {
                            precioUsd: Number(e.target.value) || 0,
                          })
                        }
                      />
                      <button
                        type="button"
                        onClick={() => rmItem(it._k)}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {it.origen === "servicio" && (
                    <div className="ml-1 mt-1.5 space-y-1.5 border-l-2 border-neutral-100 pl-3">
                      {(it.repuestos ?? []).map((r, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col gap-1.5 text-[12px] text-neutral-600 sm:flex-row sm:items-center sm:gap-2"
                        >
                          <span className="flex-1 truncate">{r.nombre}</span>
                          <div className="flex items-center gap-2">
                            <Input
                              className="w-16 text-center"
                              type="number"
                              min={1}
                              value={r.cantidad}
                              onChange={(e) =>
                                updRepuestoUsado(
                                  it._k,
                                  idx,
                                  Number(e.target.value) || 1,
                                )
                              }
                            />
                            <button
                              type="button"
                              onClick={() => rmRepuestoUsado(it._k, idx)}
                              className="grid h-6 w-6 shrink-0 place-items-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-red-500"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                      <Select
                        key={it.repuestos?.length ?? 0}
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) addRepuestoUsado(it._k, e.target.value);
                        }}
                        className="h-7 w-full text-[11px] text-neutral-500 sm:w-56"
                      >
                        <option value="">+ Repuesto usado…</option>
                        {repuestos.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.nombre} ({r.stock} en stock)
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}
                </div>
              ))}
              <div
                className="flex items-center justify-between gap-2 rounded-lg px-5 py-2"
                style={{ backgroundColor: "var(--accent-soft)" }}
              >
                <span className="text-sm font-semibold uppercase tracking-wide text-neutral-900">
                  Total
                </span>
                <span className="text-sm font-semibold tabular-nums">{fmtUsd(totalPrecio)}</span>
              </div>
            </div>
          )}
        </Card>

        {/* Pago */}
        <Card className="p-4">
          <Eyebrow>Pago</Eyebrow>

          <div className="space-y-2">
            {pagos.map((p) => {
              const recargoPct = p.recargoPct ?? 0;
              const cajasMedio = p.medio !== "cuenta_corriente" ? cajasDeMedio(p.medio) : [];
              return (
                <div key={p._k} className="space-y-1.5 rounded-lg border border-neutral-200 p-3">
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                    <Select
                      value={p.medio}
                      onChange={(e) => {
                        const medio = e.target.value as MedioPagoVenta;
                        updPago(p._k, { ...medioAPago(medio), canje: undefined });
                        if (medio === "canje") setCanjeModalKey(p._k);
                      }}
                      className="w-full text-center sm:w-40"
                    >
                      <option value="cuenta_corriente">
                        {medioPagoCfg.cuenta_corriente.emoji} Cuenta corriente
                      </option>
                      {mediosDisponibles.map((m) => (
                        <option key={m} value={m}>
                          {medioPagoCfg[m].emoji} {medioPagoCfg[m].label}
                        </option>
                      ))}
                    </Select>
                    {cajasMedio.length > 0 && (
                      <Select
                        value={p.cajaId}
                        onChange={(e) => {
                          const caja = cajasMedio.find((c) => c.id === e.target.value);
                          if (caja) updPago(p._k, { cajaId: caja.id, caja: caja.moneda });
                        }}
                        className="w-full text-center sm:w-36"
                      >
                        {cajasMedio.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre}
                          </option>
                        ))}
                      </Select>
                    )}
                    <div className="flex items-center gap-2 sm:flex-1">
                      {p.caja === "ars" ? (
                        <div className="flex h-9 flex-1 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-sm transition-colors focus-within:border-accent">
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="Cobrado $"
                            className="min-w-0 flex-1 text-center outline-none"
                            value={p.montoUsd ? fmtNum(Math.round(p.montoUsd * dolarVenta)) : ""}
                            onChange={(e) => {
                              const raw = Number(e.target.value.replace(/\D/g, "")) || 0;
                              updPago(p._k, { montoUsd: raw / dolarVenta });
                            }}
                          />
                          {p.montoUsd > 0 && (
                            <span className="shrink-0 text-[11px] text-neutral-400">
                              ≈ {fmtUsd(p.montoUsd)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <Input
                          className="flex-1 text-center"
                          type="text"
                          inputMode="numeric"
                          placeholder="Cobrado U$"
                          value={p.montoUsd ? fmtNum(Math.round(p.montoUsd)) : ""}
                          onChange={(e) => {
                            const raw = Number(e.target.value.replace(/\D/g, "")) || 0;
                            updPago(p._k, { montoUsd: raw });
                          }}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => rmPago(p._k)}
                        disabled={pagos.length === 1}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-red-500 disabled:opacity-30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {recargoPct > 0 && p.montoUsd > 0 && (
                    <p className="pl-1 text-[11px] text-amber-600">
                      + {recargoPct}% recargo → cobra{" "}
                      {fmtUsd(montoConRecargo(p.montoUsd, recargoPct))}
                    </p>
                  )}
                  {p.medio === "canje" &&
                    (p.canje ? (
                      <div className="flex items-center gap-2 pl-1 text-[11px] text-neutral-500">
                        <span className="truncate">📦 {p.canje.equipo}</span>
                        <button
                          type="button"
                          onClick={() => setCanjeModalKey(p._k)}
                          className="font-semibold text-accent hover:underline"
                        >
                          Editar
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 pl-1 text-[11px] text-amber-600">
                        <span>Falta completar el equipo canjeado</span>
                        <button
                          type="button"
                          onClick={() => setCanjeModalKey(p._k)}
                          className="font-semibold underline"
                        >
                          Completar
                        </button>
                      </div>
                    ))}
                </div>
              );
            })}
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={addPago}
              disabled={pagos.length >= destinos.length}
              className="text-xs font-medium text-accent hover:underline disabled:opacity-40"
            >
              + Agregar medio
            </button>
            {Math.abs(restante) < 0.005 ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                <Check className="h-3.5 w-3.5" /> Pago completo
              </span>
            ) : (
              <span className="flex items-center gap-2 text-xs font-semibold">
                <span
                  className={restante > 0 ? "text-amber-600" : "text-red-500"}
                >
                  {restante > 0 ? "Faltan " : "Sobran "}
                  {fmtUsd(Math.abs(restante))}
                </span>
                <button
                  type="button"
                  onClick={saldar}
                  className="rounded-md border border-neutral-200 px-2 py-0.5 text-[11px] font-medium text-neutral-600 hover:bg-neutral-50"
                >
                  Saldar
                </button>
              </span>
            )}
          </div>
        </Card>
      </div>

      <CanjeModal
        key={canjeModalKey ?? "none"}
        open={!!canjeModalKey}
        onClose={() => setCanjeModalKey(null)}
        initial={pagos.find((p) => p._k === canjeModalKey)?.canje}
        onSave={(canje) => {
          if (canjeModalKey) updPago(canjeModalKey, { canje });
          setCanjeModalKey(null);
        }}
      />

      <Dialog
        open={confirmMonto}
        onClose={() => setConfirmMonto(false)}
        accent
        title="El monto no coincide"
        footer={
          <>
            <button
              onClick={() => setConfirmMonto(false)}
              className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50 sm:w-auto"
            >
              Revisar pagos
            </button>
            <button
              disabled={pending}
              onClick={() => {
                setConfirmMonto(false);
                submit();
              }}
              className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
            >
              Confirmar de todas formas
            </button>
          </>
        }
      >
        <p className="text-sm text-neutral-600">
          Cargaste {fmtUsd(totalPrecio - restante)} en pagos, pero el total de la venta es{" "}
          {fmtUsd(totalPrecio)} ({restante > 0 ? "faltan" : "sobran"}{" "}
          {fmtUsd(Math.abs(restante))}). ¿Confirmar la venta igual?
        </p>
      </Dialog>
    </Dialog>
  );
}

/** Datos del equipo recibido en canje -- se abre al elegir la caja de
 * canje como medio de pago en "Nueva venta". Guarda un `CanjeEquipo` en el
 * pago correspondiente; recién se persiste como `Compra` (con el cliente
 * ya resuelto y el `Venta.id`) cuando se confirma la venta
 * (`lib/db/ventas.ts` → `createVenta`), mismo criterio de "creación
 * diferida" que `ClientePicker`. */
function CanjeModal({
  open,
  onClose,
  initial,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial?: CanjeEquipo;
  onSave: (canje: CanjeEquipo) => void;
}) {
  const [marca, setMarca] = useState(initial?.marca ?? "");
  const [equipo, setEquipo] = useState(initial?.equipo ?? "");
  const [imei, setImei] = useState(initial?.imei ?? "");
  const [checklist, setChecklist] = useState<Checklist>(initial?.checklist ?? CHECKLIST_VACIO);
  const [aclaraciones, setAclaraciones] = useState(initial?.aclaraciones ?? "");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      accent
      title="Equipo recibido en canje"
      description="Se guarda como una compra al confirmar la venta"
      footer={
        <>
          <button
            onClick={onClose}
            className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50 sm:w-auto"
          >
            Cancelar
          </button>
          <button
            disabled={!equipo.trim()}
            onClick={() => onSave({ marca, equipo, imei, checklist, aclaraciones })}
            className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
          >
            Guardar
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            Datos del equipo
          </p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Marca">
                <Input
                  value={marca}
                  onChange={(e) => setMarca(e.target.value)}
                  placeholder="Apple"
                />
              </Field>
              <Field label="Equipo">
                <Input
                  value={equipo}
                  onChange={(e) => setEquipo(e.target.value)}
                  placeholder="iPhone 13 Pro 128GB"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Serial / IMEI (opcional)">
                <Input value={imei} onChange={(e) => setImei(e.target.value)} />
              </Field>
              <Field label="Color (opcional)">
                <Input
                  value={checklist.color}
                  onChange={(e) => setChecklist((c) => ({ ...c, color: e.target.value }))}
                  placeholder="Ej: Negro"
                />
              </Field>
            </div>
          </div>
        </div>

        <div>
          <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            Checklist de ingreso
          </p>
          <ChecklistEditor value={checklist} onChange={setChecklist} />
        </div>

        <div>
          <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            Aclaraciones
          </p>
          <Textarea
            rows={3}
            value={aclaraciones}
            onChange={(e) => setAclaraciones(e.target.value)}
            placeholder="Ej: no incluye cargador ni caja."
          />
        </div>
      </div>
    </Dialog>
  );
}
