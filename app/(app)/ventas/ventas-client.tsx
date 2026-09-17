"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Plus, Trash2, Check, FileText, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs } from "@/components/ui/tabs";
import { ConfirmButton } from "@/components/ui/confirm-button";
import {
  ReciboDialog,
  ReciboCampos,
  ReciboLineas,
  ReciboGarantiaItems,
  ReciboNota,
  ReciboNotaLista,
  ReciboSello,
  type ReciboPagina,
} from "@/components/recibos/recibo";
import { medioPago as medioPagoCfg, dotClass } from "@/lib/status";
import { fmtUsd, fmtArs } from "@/lib/format";
import { otroCostoPromedio } from "@/lib/otros";
import {
  calcularMargenPct,
  calcularRestante,
  saldarUltimoPago,
  categoriaDe,
  RUBRO_LABEL,
} from "@/lib/ventas";
import { useDolar } from "@/lib/dolar";
import { useRealtime } from "@/components/notifications/realtime-provider";
import { cn } from "@/lib/utils";
import { filterPill, thDivider } from "@/lib/ui-styles";
import { DATE_PRESETS, presetRange, type DatePreset } from "@/lib/date-presets";
import type {
  ClienteOpcion,
  ClienteSeleccion,
  Equipo,
  MedioPago,
  OtroItem,
  Pago,
  Servicio,
  Venta,
  VentaItem,
} from "@/lib/types";
import type { Negocio } from "@/lib/db/configuracion";
import type { SessionUser } from "@/lib/auth/types";
import { ClientePicker } from "@/components/ui/cliente-picker";
import { useOutsideClick } from "@/components/ui/use-outside-click";
import { createVentaAction, deleteVentaAction } from "./actions";

const MEDIOS: MedioPago[] = [
  "pesos",
  "dolares",
  "transferencia",
  "cripto",
  "tarjeta",
  "canje",
];

/** Caja sugerida según el medio; el usuario la puede cambiar a mano. */
function defaultCaja(medio: MedioPago): "usd" | "ars" {
  return medio === "pesos" ? "ars" : "usd";
}

const PROCEDENCIAS = [
  "Local",
  "WhatsApp",
  "Instagram",
  "MercadoLibre",
  "Referido",
  "Otro",
];

function ventaCosto(v: Venta) {
  return v.items.reduce((a, i) => a + i.cantidad * (i.costoUsd ?? 0), 0);
}

function ventaGanancia(v: Venta) {
  return v.totalUsd - ventaCosto(v);
}

/** El monto de un pago se guarda siempre en USD; en pantalla, si el medio
 * es "pesos" se muestra convertido a $ a la cotización blue vigente. */
function fmtPago(medio: MedioPago, montoUsd: number, dolarVenta: number) {
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
  vendedores,
  negocio,
  user,
}: {
  initialVentas: Venta[];
  clientesOpciones: ClienteOpcion[];
  equipos: Equipo[];
  otros: OtroItem[];
  servicios: Servicio[];
  vendedores: PersonaOpcion[];
  negocio: Negocio;
  user: SessionUser;
}) {
  const { publish } = useRealtime();
  const dolarVenta = useDolar().venta;
  const esAdmin = user.rol === "admin";
  const [list, setList] = useState<Venta[]>(initialVentas);
  const [vista, setVista] = useState<"ventas" | "items">("ventas");
  const [vendFilter, setVendFilter] = useState("todos");
  const [tipoFilter, setTipoFilter] = useState<"todos" | "venta" | "reparacion">(
    "todos",
  );
  const [datePreset, setDatePreset] = useState<DatePreset>("todos");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [recibo, setRecibo] = useState<{
    venta: Venta;
    tipo: "venta" | "canje";
  } | null>(null);

  const equiposPorId = useMemo(
    () => new Map(equipos.map((e) => [e.id, e])),
    [equipos],
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

  function eliminarVenta(id: string) {
    setList((prev) => prev.filter((v) => v.id !== id));
    setOpenId(null);
    startTransition(async () => {
      await deleteVentaAction(id);
    });
  }

  const totalUsd = filtered.reduce((a, v) => a + v.totalUsd, 0);
  const margenProm =
    filtered.length > 0
      ? filtered.reduce((a, v) => a + v.margenPct, 0) / filtered.length
      : 0;

  const paginasVenta: ReciboPagina[] | undefined =
    recibo?.tipo === "venta"
      ? [
          {
            titulo: "Comprobante de venta",
            children: (
              <>
                <ReciboCampos
                  filas={[
                    ["Vendedor", recibo.venta.vendedor],
                    ["Procedencia", recibo.venta.procedencia ?? "—"],
                  ]}
                />
                <ReciboLineas
                  titulo="Detalle"
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
                  }))}
                />
              </>
            ),
          },
          ...(recibo.venta.items.some((i) => i.equipoId)
            ? [
                {
                  titulo: "Garantía",
                  children: (
                    <>
                      <ReciboGarantiaItems
                        items={recibo.venta.items.map((i) => ({
                          detalle: i.detalle,
                          serial: i.equipoId
                            ? equiposPorId.get(i.equipoId)?.imei
                            : undefined,
                          garantia: i.equipoId ? negocio.garantiaTexto || "—" : "—",
                          precioUsd: i.cantidad * i.precioUsd,
                        }))}
                      />
                      <ReciboSello />
                      <ReciboNota
                        titulo="Condiciones de garantía"
                        texto={negocio.garantiaCondiciones}
                      />
                      <ReciboNota
                        titulo="Importante"
                        texto={negocio.garantiaImportante}
                        tono="warning"
                      />
                      <ReciboNotaLista
                        titulo="Causales de anulación de la garantía"
                        texto={negocio.garantiaCausales}
                      />
                    </>
                  ),
                },
              ]
            : []),
        ]
      : undefined;

  return (
    <>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard align="left" label="Operaciones" value={filtered.length} />
          <StatCard align="left" label="Facturado" value={fmtUsd(totalUsd)} />
          <StatCard
            align="left"
            label="Margen promedio"
            value={`${margenProm.toFixed(1)}%`}
          />
          <StatCard
            align="left"
            label="Ticket promedio"
            value={fmtUsd(filtered.length ? totalUsd / filtered.length : 0)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por cliente, serie o producto…"
              className={cn("w-64 pl-9", filterPill)}
            />
          </div>
          <Tabs
            value={vista}
            onChange={setVista}
            options={[
              { value: "ventas", label: "Ventas", count: filtered.length },
              { value: "items", label: "Ítems vendidos", count: itemRows.length },
            ]}
          />
          <Select
            value={vendFilter}
            onChange={(e) => setVendFilter(e.target.value)}
            className={cn("w-44", filterPill)}
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
            className={cn("w-40", filterPill)}
          >
            <option value="todos">Todo</option>
            <option value="venta">Equipos</option>
            <option value="reparacion">Reparaciones</option>
          </Select>
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

          <button
            onClick={() => setCreating(true)}
            className="ml-auto flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-accent/40 px-4 text-sm font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft"
          >
            <Plus className="h-4 w-4" />
            Nueva venta
          </button>
        </div>

        {vista === "items" ? (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-xs text-neutral-400">
                  <th className={cn("px-5 py-3 text-center", thDivider)}>Venta</th>
                  <th className={cn("px-5 py-3 text-center", thDivider)}>Cliente</th>
                  <th className={cn("px-5 py-3 text-center", thDivider)}>Ítem</th>
                  <th className={cn("px-5 py-3 text-center", thDivider)}>Serie</th>
                  <th className={cn("px-5 py-3 text-center", thDivider)}>Categoría</th>
                  <th className={cn("px-5 py-3 text-center", thDivider)}>Cant.</th>
                  <th className={cn("px-5 py-3 text-center", thDivider)}>Precio</th>
                  <th className={cn("px-5 py-3 text-center", thDivider)}>Costo</th>
                  <th className="px-5 py-3 text-center">Margen</th>
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
                    <td className="px-5 py-2 text-center text-neutral-500">
                      {RUBRO_LABEL[categoriaDe(i)]}
                    </td>
                    <td className="px-5 py-2 text-center tabular-nums text-neutral-500">
                      {i.cantidad}
                    </td>
                    <td className="px-5 py-2 text-center tabular-nums">
                      {fmtUsd(i.precioUsd)}
                    </td>
                    <td className="px-5 py-2 text-center tabular-nums text-neutral-500">
                      {i.costoUsd !== undefined ? fmtUsd(i.costoUsd) : "—"}
                    </td>
                    <td className="px-5 py-2 text-center tabular-nums font-semibold">
                      {i.costoUsd !== undefined
                        ? `${calcularMargenPct(i.precioUsd, i.costoUsd).toFixed(1)}%`
                        : "—"}
                    </td>
                  </tr>
                ))}
                {itemRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-5 py-10 text-center text-sm text-neutral-400"
                    >
                      Sin ítems para estos filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-xs text-neutral-400">
                <th className={cn("px-5 py-3 text-center", thDivider)}>Venta</th>
                <th className={cn("px-5 py-3 text-center", thDivider)}>Cliente</th>
                <th className={cn("px-5 py-3 text-center", thDivider)}>Detalle</th>
                <th className={cn("px-5 py-3 text-center", thDivider)}>Pago</th>
                <th className={cn("px-5 py-3 text-center", thDivider)}>Costo</th>
                <th className={cn("px-5 py-3 text-center", thDivider)}>Margen</th>
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
                  <td className="px-5 py-2 text-center tabular-nums text-neutral-500">
                    {fmtUsd(ventaCosto(v))}
                  </td>
                  <td className="px-5 py-2 text-center tabular-nums text-neutral-500">
                    {v.margenPct.toFixed(1)}%
                  </td>
                  <td className="px-5 py-2 text-center font-semibold tabular-nums">
                    {fmtUsd(v.totalUsd)}
                  </td>
                  <td className="px-5 py-2 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRecibo({ venta: v, tipo: "venta" });
                      }}
                      title="Ver recibo"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-accent-soft hover:text-accent"
                    >
                      <FileText className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-10 text-center text-sm text-neutral-400"
                  >
                    Sin ventas para estos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
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
        vendedores={vendedores}
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
                <ConfirmButton
                  label="Eliminar venta"
                  onConfirm={() => eliminarVenta(open.id)}
                  className="mr-auto"
                />
              )}
              <button
                onClick={() => setOpenId(null)}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
              >
                Cerrar
              </button>
              {open.pagos.some((p) => p.medio === "canje") && (
                <button
                  onClick={() => setRecibo({ venta: open, tipo: "canje" })}
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-accent/40 px-4 text-sm font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft"
                >
                  <FileText className="h-4 w-4" /> Recibo de canje
                </button>
              )}
              <button
                onClick={() => setRecibo({ venta: open, tipo: "venta" })}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-accent/40 px-4 text-sm font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft"
              >
                <FileText className="h-4 w-4" /> Comprobante de venta
              </button>
            </>
          )
        }
      >
        {open && <VentaDetalle venta={open} />}
      </Dialog>

      <ReciboDialog
        key={recibo ? `${recibo.tipo}-${recibo.venta.id}` : "none"}
        open={!!recibo}
        onClose={() => setRecibo(null)}
        titulo={
          recibo?.tipo === "canje" ? "Recibo de equipo en parte de pago" : "Comprobante de venta"
        }
        nro={recibo?.venta.id ?? ""}
        fecha={recibo?.venta.fecha ?? ""}
        cliente={recibo?.venta.cliente ?? ""}
        negocio={negocio}
        paginas={paginasVenta}
      >
        {recibo?.tipo === "canje" && (
          <>
            <ReciboCampos
              filas={[
                ["Aplicado a", `Venta ${recibo.venta.id}`],
                [
                  "Valor reconocido",
                  fmtUsd(
                    recibo.venta.pagos
                      .filter((p) => p.medio === "canje")
                      .reduce((a, p) => a + p.montoUsd, 0),
                  ),
                ],
              ]}
            />
            <div className="mt-5 space-y-3 text-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Equipo recibido (completar a mano)
              </p>
              {["Modelo y capacidad", "IMEI / Serie", "Estado y accesorios"].map(
                (l) => (
                  <p
                    key={l}
                    className="border-b border-dashed border-neutral-300 pb-6 text-xs text-neutral-400"
                  >
                    {l}
                  </p>
                ),
              )}
            </div>
            <p className="mt-4 text-xs text-neutral-500">
              El cliente declara ser titular del equipo entregado y que no tiene
              pedido de secuestro ni deudas asociadas.
            </p>
          </>
        )}
      </ReciboDialog>
    </>
  );
}

// ────────────────────── Detalle de venta ──────────────────────

function VentaDetalle({ venta }: { venta: Venta }) {
  const dolarVenta = useDolar().venta;
  const metaFields: { label: string; value: string }[] = [
    { label: "Cliente", value: venta.cliente },
    { label: "Vendedor", value: venta.vendedor },
    ...(venta.procedencia
      ? [{ label: "Procedencia", value: venta.procedencia }]
      : []),
    {
      label: "Tipo",
      value:
        venta.tipo === "venta" ? "Venta de equipos" : "Reparación / servicio",
    },
  ];
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
          Información general
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {metaFields.map((f) => (
            <Card key={f.label} className="p-3 text-center">
              <p className="font-grotesk border-b border-neutral-300 pb-0.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                {f.label}
              </p>
              <p className="mt-2 truncate text-sm font-normal text-neutral-600">
                {f.value}
              </p>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
          Ítems
        </p>
        <div className="overflow-hidden rounded-xl border border-neutral-200">
          <table className="w-full text-sm [&_td]:text-center [&_th]:text-center">
            <thead>
              <tr className="border-b border-neutral-100 text-xs text-neutral-400">
                <th className={cn("px-4 py-2 !text-start", thDivider)}>
                  Detalle
                </th>
                <th className={cn("px-4 py-2", thDivider)}>Cant</th>
                <th className={cn("px-4 py-2", thDivider)}>Costo</th>
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
                  <td className="px-4 py-2.5 tabular-nums text-neutral-500">
                    {fmtUsd(i.costoUsd ?? 0)}
                  </td>
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
                style={{ backgroundColor: "#edecf8", backgroundImage: "none" }}
              >
                <td className="px-4 py-2.5 !text-start uppercase tracking-wide" colSpan={4}>
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
        <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
          Resumen financiero
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {venta.pagos.map((p, i) => (
            <Card
              key={i}
              className="flex flex-col p-3 text-center"
              title={`Caja ${p.caja.toUpperCase()}`}
            >
              <p className="font-grotesk border-b border-neutral-300 pb-0.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Método {i + 1}
              </p>
              <div className="flex flex-1 flex-col items-center justify-center gap-1.5 pt-2">
                <p className="truncate text-sm font-normal tabular-nums text-neutral-600">
                  {fmtPago(p.medio, p.montoUsd, dolarVenta)}
                </p>
                <span className="inline-flex max-w-full items-center gap-1 truncate rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-700">
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
          <Card className="flex flex-col p-3 text-center">
            <p className="font-grotesk border-b border-neutral-300 pb-0.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Costo total
            </p>
            <div className="flex flex-1 items-center justify-center pt-2">
              <p className="truncate text-sm font-normal text-neutral-600">
                {fmtUsd(ventaCosto(venta))}
              </p>
            </div>
          </Card>
          <Card className="flex flex-col p-3 text-center">
            <p className="font-grotesk border-b border-neutral-300 pb-0.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Ganancia bruta
            </p>
            <div className="flex flex-1 items-center justify-center pt-2">
              <p className="truncate text-sm font-normal tabular-nums text-neutral-600">
                {fmtUsd(ventaGanancia(venta))}
              </p>
            </div>
          </Card>
          <Card className="flex flex-col p-3 text-center">
            <p className="font-grotesk border-b border-neutral-300 pb-0.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              Margen
            </p>
            <div className="flex flex-1 items-center justify-center pt-2">
              <p className="truncate text-sm font-normal text-neutral-600">
                {venta.margenPct.toFixed(1)}%
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── Nueva venta ───────────────────────────

const rid = () => Math.random().toString(36).slice(2);

type Origen = "equipo" | "otro" | "servicio" | "libre";
type DraftItem = VentaItem & { _k: string; origen: Origen };
type DraftPago = Pago & { _k: string };

type CatItem = {
  key: string;
  origen: Exclude<Origen, "libre">;
  refId: string;
  nombre: string;
  costoUsd: number;
  precioUsd: number;
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

function Eyebrow({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
        {children}
      </p>
      {right}
    </div>
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

  const matches = catalogo.filter(
    (c) =>
      c.nombre.toLowerCase().includes(q.toLowerCase()) &&
      !(c.origen === "equipo" && yaAgregados.includes(c.refId)),
  );

  return (
    <div ref={ref} className="relative">
      <Input
        placeholder="Buscar equipo, producto o servicio por nombre…"
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
  vendedores,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (v: Venta) => void;
  clientesOpciones: ClienteOpcion[];
  equipos: Equipo[];
  otros: OtroItem[];
  servicios: Servicio[];
  vendedores: PersonaOpcion[];
}) {
  const [cliente, setCliente] = useState<ClienteSeleccion | null>(null);

  const [vendedorId, setVendedorId] = useState(vendedores[0]?.id ?? "");
  const [procedencia, setProcedencia] = useState(PROCEDENCIAS[0]);

  const [items, setItems] = useState<DraftItem[]>([]);
  const [pagos, setPagos] = useState<DraftPago[]>([
    { _k: rid(), medio: "pesos", montoUsd: 0, caja: defaultCaja("pesos") },
  ]);
  const [pending, startTransition] = useTransition();

  const totalPrecio = items.reduce((a, i) => a + i.cantidad * i.precioUsd, 0);
  const totalCosto = items.reduce(
    (a, i) => a + i.cantidad * (i.costoUsd ?? 0),
    0,
  );
  const margenPct = calcularMargenPct(totalPrecio, totalCosto);
  const restante = calcularRestante(totalPrecio, pagos);

  useEffect(() => {
    setPagos((prev) =>
      prev.length === 1 ? [{ ...prev[0], montoUsd: totalPrecio }] : prev,
    );
  }, [totalPrecio]);

  const clienteNombre = cliente?.nombre ?? "";

  const valid =
    totalPrecio > 0 &&
    items.every((i) => i.detalle.trim() && i.precioUsd > 0) &&
    clienteNombre.length > 0 &&
    pagos.every((p) => p.montoUsd > 0) &&
    Math.abs(restante) < 0.005;

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

  const updPago = (k: string, patch: Partial<DraftPago>) =>
    setPagos((p) => p.map((x) => (x._k === k ? { ...x, ...patch } : x)));
  const rmPago = (k: string) =>
    setPagos((p) => (p.length > 1 ? p.filter((x) => x._k !== k) : p));
  const addPago = () =>
    setPagos((p) => {
      const medio =
        MEDIOS.find((m) => !p.some((x) => x.medio === m)) ?? "transferencia";
      return [
        ...p,
        {
          _k: rid(),
          medio,
          montoUsd: restante > 0 ? restante : 0,
          caja: defaultCaja(medio),
        },
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
        procedencia,
        items: items.map(({ _k, origen, ...i }) => ({ ...i, categoria: origen })),
        totalUsd: totalPrecio,
        pagos: pagos.map(({ _k, ...p }) => p),
        margenPct: Math.round(margenPct * 10) / 10,
        tipo: items.some((i) => i.origen === "equipo") ? "venta" : "reparacion",
      });
      onCreate({ ...venta, vendedor: vendedorNombre || venta.vendedor });
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Nueva venta"
      description="El número de venta se asigna al confirmar"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" disabled={!valid || pending} onClick={submit}>
            {pending ? "Confirmando…" : `Confirmar venta · ${fmtUsd(totalPrecio)}`}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Cliente */}
        <section>
          <Eyebrow>Cliente</Eyebrow>
          <ClientePicker clientes={clientesOpciones} value={cliente} onChange={setCliente} />
        </section>

        {/* Vendedor + Procedencia */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Vendedor" labelClassName="text-center">
            <Select
              value={vendedorId}
              onChange={(e) => setVendedorId(e.target.value)}
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
            >
              {PROCEDENCIAS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
          </Field>
        </div>

        {/* Ítems */}
        <section>
          <Eyebrow
            right={
              <span className="text-xs text-neutral-400">
                {items.length} ítem{items.length === 1 ? "" : "s"}
              </span>
            }
          >
            Ítems
          </Eyebrow>

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
              <div className="flex items-center gap-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                <span className="flex-1">Ítem</span>
                <span className="w-12 text-center">Cant</span>
                <span className="w-24 text-center">Precio</span>
                <span className="w-9" />
              </div>
              {items.map((it) => (
                <div key={it._k} className="flex items-center gap-2">
                  <Input
                    className="min-w-0 flex-1"
                    placeholder="Nombre del ítem"
                    value={it.detalle}
                    readOnly={it.origen !== "libre"}
                    onChange={(e) =>
                      updItem(it._k, { detalle: e.target.value })
                    }
                  />
                  <Input
                    className="w-12 text-center"
                    type="number"
                    min={1}
                    value={it.cantidad}
                    onChange={(e) =>
                      updItem(it._k, { cantidad: Number(e.target.value) || 1 })
                    }
                  />
                  <Input
                    className="w-24"
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
              ))}
            </div>
          )}
        </section>

        {/* Pago */}
        <section>
          <Eyebrow
            right={
              <span className="text-sm font-semibold tabular-nums">
                Total {fmtUsd(totalPrecio)}
                <span className="ml-2 text-xs font-normal text-neutral-400">
                  margen {margenPct.toFixed(0)}%
                </span>
              </span>
            }
          >
            Pago
          </Eyebrow>

          <div className="space-y-2">
            {pagos.map((p) => (
              <div key={p._k} className="flex items-center gap-2">
                <Select
                  value={p.medio}
                  onChange={(e) => {
                    const medio = e.target.value as MedioPago;
                    updPago(p._k, { medio, caja: defaultCaja(medio) });
                  }}
                  className="w-40"
                >
                  {MEDIOS.map((m) => (
                    <option key={m} value={m}>
                      {medioPagoCfg[m].label}
                    </option>
                  ))}
                </Select>
                <Input
                  className="flex-1"
                  type="number"
                  min={0}
                  placeholder="U$"
                  value={p.montoUsd || ""}
                  onChange={(e) =>
                    updPago(p._k, { montoUsd: Number(e.target.value) || 0 })
                  }
                />
                <Select
                  value={p.caja}
                  onChange={(e) =>
                    updPago(p._k, { caja: e.target.value as "usd" | "ars" })
                  }
                  className="w-32"
                >
                  <option value="usd">Caja USD</option>
                  <option value="ars">Caja ARS</option>
                </Select>
                <button
                  type="button"
                  onClick={() => rmPago(p._k)}
                  disabled={pagos.length === 1}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-red-500 disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={addPago}
              disabled={pagos.length >= MEDIOS.length}
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
        </section>
      </div>
    </Dialog>
  );
}
