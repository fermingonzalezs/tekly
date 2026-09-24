"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Plus,
  Wrench,
  ArrowRight,
  Check,
  FileText,
  Receipt,
  FileCheck2,
  ClipboardCheck,
  Pencil,
  Search,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { StatCard } from "@/components/ui/stat-card";
import { ChecklistEditor, CHECKLIST_VACIO } from "@/components/ui/checklist-editor";
import { Tabs } from "@/components/ui/tabs";
import { ClientePicker } from "@/components/ui/cliente-picker";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ServiciosCatalogo } from "@/components/servicios-catalogo";
import { RepairsChart } from "@/components/dashboard/repairs-chart";
import { ReparacionesSplit } from "@/components/dashboard/reparaciones-split";
import {
  ReciboDialog,
  ReciboCampos,
  ReciboLineas,
  ReciboChecklist,
  ReciboNota,
  ReciboFirmas,
} from "@/components/recibos/recibo";
import { TICKET_FLOW, nextTicketStatus, ticketStatus, dotClass } from "@/lib/status";
import { fmtUsd } from "@/lib/format";
import { useRealtime } from "@/components/notifications/realtime-provider";
import type {
  Checklist,
  ClienteOpcion,
  ClienteSeleccion,
  Repuesto,
  Servicio,
  Ticket,
  TicketServicio,
  TicketStatus,
} from "@/lib/types";
import type { Negocio } from "@/lib/db/configuracion";
import type { SessionUser } from "@/lib/auth/types";
import { cn } from "@/lib/utils";
import { filterPill, thDivider } from "@/lib/ui-styles";
import { DATE_PRESETS, presetRange, type DatePreset } from "@/lib/date-presets";
import {
  addTicketItemAction,
  createTicketAction,
  removeTicketItemAction,
  saveServicioAction,
  setChecklistEgresoAction,
  setTicketEstadoAction,
  updateTicketItemPrecioAction,
  deleteTicketAction,
} from "./actions";

/** Fila de `ReciboLineas` para un ítem de ticket -- misma garantía/cantidad
 * en Ingreso, Presupuesto y Egreso, para no repetir el mapeo 3 veces. */
function lineaDeItem(s: TicketServicio) {
  return {
    detalle: s.nombre,
    cantidad: s.cantidad,
    montoUsd: s.precioUsd * (s.cantidad ?? 1),
    garantia: s.garantiaDias !== undefined ? `${s.garantiaDias} días` : "—",
  };
}

/** Igual que `lineaDeItem` pero sin columna Garantía -- Repuestos/Ítems
 * extra del Presupuesto no tienen garantía de catálogo, a diferencia de
 * Servicios (que sí, ver `lineaDeItem`). */
function lineaSinGarantia(s: TicketServicio) {
  return {
    detalle: s.nombre,
    cantidad: s.cantidad,
    montoUsd: s.precioUsd * (s.cantidad ?? 1),
  };
}

function matchesQuery(t: Ticket, q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return (
    t.cliente.toLowerCase().includes(needle) ||
    t.equipo.toLowerCase().includes(needle) ||
    t.falla.toLowerCase().includes(needle) ||
    t.imei.toLowerCase().includes(needle)
  );
}

export function ReparacionesClient({
  initialTickets,
  initialServicios,
  repuestos,
  tecnicos,
  clientesOpciones,
  negocio,
  user,
}: {
  initialTickets: Ticket[];
  initialServicios: Servicio[];
  repuestos: Repuesto[];
  tecnicos: { id: string; nombre: string }[];
  clientesOpciones: ClienteOpcion[];
  negocio: Negocio;
  user: SessionUser;
}) {
  const { publish } = useRealtime();
  const actor = user.nombre;
  const esAdmin = user.rol === "admin";
  const [list, setList] = useState<Ticket[]>(initialTickets);
  const [tecFilter, setTecFilter] = useState("todos");
  const [estFilter, setEstFilter] = useState<"todos" | TicketStatus>("todos");
  const [datePreset, setDatePreset] = useState<DatePreset>("todos");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [creating, setCreating] = useState(false);
  const [vista, setVista] = useState<"tickets" | "servicios">("tickets");
  const [recibo, setRecibo] = useState<{
    ticket: Ticket;
    tipo: "ingreso" | "presupuesto" | "egreso";
  } | null>(null);
  const [checklistEgresoTicket, setChecklistEgresoTicket] = useState<Ticket | null>(null);
  const [agregandoItemA, setAgregandoItemA] = useState<Ticket | null>(null);
  const [editandoPrecio, setEditandoPrecio] = useState<{
    ticketId: number;
    index: number;
    valor: string;
  } | null>(null);
  const [chartsOpen, setChartsOpen] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    setEditandoPrecio(null);
  }, [openId]);

  const clientesPorId = useMemo(
    () => new Map(clientesOpciones.map((c) => [c.id, c])),
    [clientesOpciones],
  );
  const [, startTransition] = useTransition();

  const range =
    datePreset === "personalizado"
      ? { desde, hasta }
      : (presetRange(datePreset) ?? { desde: "", hasta: "" });

  const enRango = useMemo(
    () =>
      list.filter(
        (t) =>
          (!range.desde || t.fechaISO >= range.desde) &&
          (!range.hasta || t.fechaISO <= range.hasta),
      ),
    [list, range.desde, range.hasta],
  );

  const filtered = useMemo(
    () =>
      enRango.filter(
        (t) =>
          (tecFilter === "todos" ||
            (tecFilter === "sin" ? !t.tecnico : t.tecnico === tecFilter)) &&
          (estFilter === "todos" || t.estado === estFilter) &&
          matchesQuery(t, q),
      ),
    [enRango, tecFilter, estFilter, q],
  );

  const open = list.find((t) => t.id === openId) ?? null;

  function aplicarEstado(id: number, estado: TicketStatus) {
    startTransition(async () => {
      const actualizado = await setTicketEstadoAction(id, estado);
      setList((prev) => prev.map((t) => (t.id === id ? actualizado : t)));
      if (estado === "listo")
        publish({ type: "ticket_ready", actor, ticket: id, model: actualizado.equipo });
      if (estado === "aprobado")
        publish({
          type: "repair_approved",
          actor,
          ticket: id,
          amountUsd: actualizado.presupuestoUsd,
        });
    });
  }

  function eliminarTicket(id: number) {
    const t = list.find((x) => x.id === id);
    setList((prev) => prev.filter((t) => t.id !== id));
    setOpenId(null);
    setConfirmDelete(false);
    startTransition(async () => {
      await deleteTicketAction(id);
    });
    if (t) {
      publish({
        type: "item_deleted",
        actor,
        entity: "Ticket",
        label: `#${t.id} · ${t.equipo}`,
      });
    }
  }

  function advance(id: number) {
    const t = list.find((x) => x.id === id);
    if (!t) return;
    const next = nextTicketStatus(t.estado);
    if (next) aplicarEstado(id, next);
  }

  function guardarChecklistEgreso(id: number, checklist: Checklist) {
    setChecklistEgresoTicket(null);
    startTransition(async () => {
      const actualizado = await setChecklistEgresoAction(id, checklist);
      setList((prev) => prev.map((t) => (t.id === id ? actualizado : t)));
    });
  }

  function agregarItem(id: number, item: TicketServicio) {
    setAgregandoItemA(null);
    startTransition(async () => {
      const actualizado = await addTicketItemAction(id, item);
      setList((prev) => prev.map((t) => (t.id === id ? actualizado : t)));
    });
  }

  function quitarItem(id: number, index: number) {
    startTransition(async () => {
      const actualizado = await removeTicketItemAction(id, index);
      setList((prev) => prev.map((t) => (t.id === id ? actualizado : t)));
    });
  }

  function guardarPrecio() {
    if (!editandoPrecio) return;
    const valor = Number(editandoPrecio.valor);
    if (!Number.isFinite(valor) || valor < 0) return;
    const { ticketId, index } = editandoPrecio;
    setEditandoPrecio(null);
    startTransition(async () => {
      const actualizado = await updateTicketItemPrecioAction(ticketId, index, valor);
      setList((prev) => prev.map((t) => (t.id === ticketId ? actualizado : t)));
    });
  }

  const counts = TICKET_FLOW.map((s) => ({
    s,
    n: list.filter((t) => t.estado === s).length,
  }));

  return (
    <>
      <div className="space-y-5">
        {/* gráficos: siempre visibles (tickets o servicios), se pueden ocultar */}
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
            <div className="mt-3 grid gap-5 xl:grid-cols-2">
              <ReparacionesSplit tickets={enRango} />
              <RepairsChart tickets={enRango} />
            </div>
          )}
        </div>

        {/* pipeline resumen: siempre visible -- en mobile son 8 tarjetas
            (demasiadas para esa altura), se reemplaza por un desplegable */}
        <Select
          value={estFilter}
          onChange={(e) => setEstFilter(e.target.value as "todos" | TicketStatus)}
          className={cn("w-full sm:hidden", filterPill)}
        >
          <option value="todos">Todos los estados ({list.length})</option>
          {counts.map(({ s, n }) => (
            <option key={s} value={s}>
              {ticketStatus[s].label} ({n})
            </option>
          ))}
        </Select>
        <div className="hidden gap-3 sm:grid sm:grid-cols-4 xl:grid-cols-8">
          {counts.map(({ s, n }) => (
            <StatCard
              key={s}
              align="left"
              label={ticketStatus[s].label}
              value={n}
              active={estFilter === s}
              onClick={() => setEstFilter(estFilter === s ? "todos" : s)}
            />
          ))}
        </div>

        {/* tabs + filtros + acción, todo en la misma fila */}
        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
          <Tabs
            value={vista}
            onChange={setVista}
            className="w-full justify-between md:w-auto md:justify-start"
            options={[
              { value: "tickets", label: "Tickets", count: list.length },
              { value: "servicios", label: "Servicios" },
            ]}
          />
          {vista === "tickets" && (
            <>
              <div className="relative w-full md:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por cliente, equipo o IMEI…"
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
                <Select
                  value={tecFilter}
                  onChange={(e) => setTecFilter(e.target.value)}
                  className={cn("w-full md:w-52", filterPill)}
                >
                  <option value="todos">Todos los técnicos</option>
                  <option value="sin">Sin asignar</option>
                  {tecnicos.map((t) => (
                    <option key={t.id} value={t.nombre}>
                      {t.nombre}
                    </option>
                  ))}
                </Select>
                {/* En mobile el estado ya se filtra con el desplegable del
                    pipeline de arriba -- este queda solo de sm en adelante,
                    al lado de las tarjetas. */}
                <Select
                  value={estFilter}
                  onChange={(e) =>
                    setEstFilter(e.target.value as "todos" | TicketStatus)
                  }
                  className={cn("hidden sm:block sm:w-52", filterPill)}
                >
                  <option value="todos">Todos los estados</option>
                  {TICKET_FLOW.map((s) => (
                    <option key={s} value={s}>
                      {ticketStatus[s].label}
                    </option>
                  ))}
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
                Nuevo ticket
              </button>
            </>
          )}
        </div>

        {vista === "servicios" ? (
          <ServiciosCatalogo
            initialServicios={initialServicios}
            onSave={saveServicioAction}
          />
        ) : (
          <>
        <div className="space-y-2 md:hidden">
          {filtered.map((t) => (
            <Card
              key={t.id}
              onClick={() => setOpenId(t.id)}
              className="cursor-pointer overflow-hidden p-0"
            >
              <div className="flex items-center justify-between gap-2 bg-[#352f86] px-4 py-2 text-white">
                <span className="text-sm font-semibold">#{t.id}</span>
                <span className="text-xs text-white/70">{t.ingreso}</span>
              </div>

              <div className="flex items-stretch gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-900">{t.cliente}</p>
                  <p className="mt-0.5 truncate text-xs text-neutral-500">
                    {t.equipo} · {t.falla}
                  </p>

                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-2.5 text-[11px] text-neutral-400">
                    <span>{t.tecnico ?? "Sin asignar"}</span>
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                      <span
                        className={cn("h-1.5 w-1.5 rounded-full", dotClass[ticketStatus[t.estado].tone])}
                      />
                      {ticketStatus[t.estado].label}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center border-l border-neutral-100 pl-3">
                  <p className="text-base font-semibold tabular-nums">
                    {t.presupuestoUsd ? fmtUsd(t.presupuestoUsd) : "—"}
                  </p>
                </div>
              </div>
            </Card>
          ))}
          {filtered.length === 0 && (
            <p className="rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
              No hay tickets con estos filtros.
            </p>
          )}
        </div>
        <Card className="hidden overflow-hidden md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-xs text-neutral-400">
                <th className={cn("px-5 py-3 text-center", thDivider)}>
                  Ticket
                </th>
                <th className={cn("px-5 py-3 text-center", thDivider)}>
                  Cliente
                </th>
                <th className={cn("px-5 py-3 text-center", thDivider)}>
                  Equipo
                </th>
                <th className={cn("px-5 py-3 text-center", thDivider)}>
                  Técnico
                </th>
                <th className={cn("px-5 py-3 text-center", thDivider)}>
                  Presupuesto
                </th>
                <th className="px-5 py-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setOpenId(t.id)}
                  className="cursor-pointer border-t border-neutral-100 first:border-t-0 hover:bg-neutral-50"
                >
                  <td className="px-5 py-2 text-center font-medium text-neutral-500">
                    #{t.id}
                    <span className="block text-xs font-normal text-neutral-400">
                      {t.ingreso}
                    </span>
                  </td>
                  <td className="max-w-[140px] truncate px-5 py-2 text-center">
                    {t.cliente}
                  </td>
                  <td className="max-w-[220px] truncate px-5 py-2 text-start">
                    {t.equipo}
                    <span className="block truncate text-xs text-neutral-400">
                      {t.falla}
                    </span>
                  </td>
                  <td className="max-w-[110px] truncate px-5 py-2 text-center">
                    {t.tecnico ?? (
                      <span className="text-neutral-400">Sin asignar</span>
                    )}
                  </td>
                  <td className="px-5 py-2 text-center font-semibold tabular-nums">
                    {t.presupuestoUsd ? fmtUsd(t.presupuestoUsd) : "—"}
                  </td>
                  <td className="px-5 py-2 text-center">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          dotClass[ticketStatus[t.estado].tone],
                        )}
                      />
                      {ticketStatus[t.estado].label}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-10 text-center text-sm text-neutral-400"
                  >
                    No hay tickets con estos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
        </>
        )}
      </div>

      {/* Detalle */}
      <Dialog
        open={!!open}
        onClose={() => setOpenId(null)}
        size="lg"
        accent
        title={open ? `Ticket #${open.id} · ${open.equipo}` : ""}
        description={open ? `${open.cliente} · ingresó ${open.ingreso}` : ""}
        footer={
          open && (
            <>
              {esAdmin && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-red-200 px-4 text-sm font-semibold text-red-600 transition-colors hover:border-red-300 hover:bg-red-50 sm:mr-auto sm:w-auto"
                >
                  <Trash2 className="h-4 w-4" /> Eliminar ticket
                </button>
              )}
              <button
                onClick={() => setOpenId(null)}
                className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50 sm:w-auto"
              >
                Cerrar
              </button>
              {open.estado !== "listo" && open.estado !== "entregado" && (
                <button
                  onClick={() =>
                    ["en_reparacion", "esperando_repuesto"].includes(open.estado)
                      ? aplicarEstado(open.id, "listo")
                      : advance(open.id)
                  }
                  className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent/90 sm:w-auto"
                >
                  {["en_reparacion", "esperando_repuesto"].includes(open.estado) ? (
                    <>Marcar listo</>
                  ) : (
                    <>
                      Avanzar a{" "}
                      {ticketStatus[nextTicketStatus(open.estado)!]?.label}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              )}
            </>
          )
        }
      >
        {open && (
          <div className="space-y-4">
            <div>
              <p className="mb-1.5 border-b border-neutral-200 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Información general
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Card className="p-2 text-center">
                  <p className="font-grotesk truncate border-b border-neutral-300 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                    IMEI
                  </p>
                  <p className="mt-1.5 truncate text-sm font-normal text-neutral-600">
                    {open.imei}
                  </p>
                </Card>
                <Card className="p-2 text-center">
                  <p className="font-grotesk truncate border-b border-neutral-300 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                    Estado
                  </p>
                  <div className="mt-1.5 flex justify-center">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          dotClass[ticketStatus[open.estado].tone],
                        )}
                      />
                      {ticketStatus[open.estado].label}
                    </span>
                  </div>
                </Card>
                {open.claveCodigo && (
                  <Card className="p-2 text-center">
                    <p className="font-grotesk truncate border-b border-neutral-300 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                      Clave / código
                    </p>
                    <p className="mt-1.5 truncate text-sm font-normal text-neutral-600">
                      {open.claveCodigo}
                    </p>
                  </Card>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <Card className="p-3">
                  <p className="font-grotesk border-b border-neutral-300 pb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                    Falla reportada
                  </p>
                  <p className="mt-1.5 text-start text-sm text-neutral-700">{open.falla}</p>
                </Card>
                {open.reparacionSolicitada && (
                  <Card className="p-3">
                    <p className="font-grotesk border-b border-neutral-300 pb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                      Reparación solicitada
                    </p>
                    <p className="mt-1.5 text-start text-sm text-neutral-700">
                      {open.reparacionSolicitada}
                    </p>
                  </Card>
                )}
                {open.descripcionEquipo && (
                  <Card className="col-span-2 p-3">
                    <p className="font-grotesk border-b border-neutral-300 pb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                      Observaciones
                    </p>
                    <p className="mt-1.5 text-start text-sm text-neutral-700">
                      {open.descripcionEquipo}
                    </p>
                  </Card>
                )}
              </div>
            </div>

            {/* stepper */}
            <div>
              <p className="mb-1.5 border-b border-neutral-200 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Progreso
              </p>
              <ol className="flex flex-wrap justify-center gap-1.5">
                {TICKET_FLOW.map((s) => {
                  const idx = TICKET_FLOW.indexOf(s);
                  const cur = TICKET_FLOW.indexOf(open.estado);
                  return (
                    <li
                      key={s}
                      className={cn(
                        "rounded-md px-2 py-1 text-[11px] font-medium",
                        idx < cur && "bg-emerald-50 text-emerald-600",
                        idx === cur && "bg-accent text-white",
                        idx > cur && "bg-neutral-100 text-neutral-400",
                      )}
                    >
                      {ticketStatus[s].label}
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* servicios */}
            <div>
              <div className="mb-1.5 flex items-center justify-between border-b border-neutral-200 pb-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                  Servicios asociados
                </p>
                <button
                  onClick={() => setAgregandoItemA(open)}
                  className="flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent/80"
                >
                  <Plus className="h-3.5 w-3.5" /> Agregar
                </button>
              </div>
              {open.servicios.length === 0 ? (
                <p className="rounded-xl border border-dashed border-neutral-200 px-4 py-6 text-center text-sm text-neutral-400">
                  Sin servicios cargados todavía.
                </p>
              ) : (
                <>
                  <Card className="divide-y divide-neutral-100 overflow-hidden md:hidden">
                    {open.servicios.map((s, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 px-3 py-2">
                        <span className="flex min-w-0 flex-1 items-center gap-2 truncate text-sm text-neutral-900">
                          <Wrench className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                          <span className="truncate">
                            {(s.cantidad ?? 1) > 1 ? `${s.cantidad}× ` : ""}
                            {s.nombre}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">
                          {fmtUsd(s.precioUsd * (s.cantidad ?? 1))}
                        </span>
                        <button
                          onClick={() => quitarItem(open.id, i)}
                          className="shrink-0 text-neutral-300 hover:text-red-500"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <div
                      className="flex items-center justify-between gap-2 px-3 py-2"
                      style={{ backgroundColor: "#edecf8" }}
                    >
                      <span className="text-sm font-semibold uppercase tracking-wide text-neutral-900">
                        Presupuesto total
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        {fmtUsd(open.presupuestoUsd)}
                      </span>
                    </div>
                  </Card>
                  <div className="hidden overflow-hidden rounded-xl border border-neutral-200 md:block">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th
                            className={cn(
                              "px-4 py-2 text-center text-[11px] font-medium",
                              thDivider,
                            )}
                          >
                            Servicio
                          </th>
                          <th
                            className={cn(
                              "px-4 py-2 text-center text-[11px] font-medium",
                              thDivider,
                            )}
                          >
                            Precio
                          </th>
                          <th className="px-4 py-2 text-center text-[11px] font-medium">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {open.servicios.map((s, i) => (
                          <tr key={i}>
                            <td className="px-4 py-2.5 text-start">
                              <span className="flex items-center gap-2">
                                <Wrench className="h-3.5 w-3.5 text-neutral-400" />
                                {(s.cantidad ?? 1) > 1 ? `${s.cantidad}× ` : ""}
                                {s.nombre}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-center font-medium tabular-nums">
                              {editandoPrecio?.ticketId === open.id &&
                              editandoPrecio.index === i ? (
                                <div className="flex items-center justify-center gap-1">
                                  <Input
                                    type="number"
                                    min={0}
                                    autoFocus
                                    value={editandoPrecio.valor}
                                    onChange={(e) =>
                                      setEditandoPrecio((prev) =>
                                        prev ? { ...prev, valor: e.target.value } : prev,
                                      )
                                    }
                                    className="h-7 w-20 text-center"
                                  />
                                  <button
                                    onClick={guardarPrecio}
                                    className="text-emerald-600 hover:text-emerald-700"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setEditandoPrecio(null)}
                                    className="text-neutral-400 hover:text-neutral-600"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                fmtUsd(s.precioUsd * (s.cantidad ?? 1))
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() =>
                                    setEditandoPrecio({
                                      ticketId: open.id,
                                      index: i,
                                      valor: String(s.precioUsd),
                                    })
                                  }
                                  title="Editar precio"
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-accent-soft hover:text-accent"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => quitarItem(open.id, i)}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-500"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        <tr
                          className="font-semibold text-neutral-900"
                          style={{
                            backgroundColor: "#edecf8",
                            backgroundImage: "none",
                          }}
                        >
                          <td
                            className="px-4 py-2.5 text-start uppercase tracking-wide"
                            colSpan={2}
                          >
                            Presupuesto total
                          </td>
                          <td className="px-4 py-2.5 text-center tabular-nums">
                            {fmtUsd(open.presupuestoUsd)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {open.nota && (
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
                {open.nota}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2 border-t border-neutral-100 pt-3">
              <button
                onClick={() => setRecibo({ ticket: open, tipo: "ingreso" })}
                className="flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-full border border-accent/40 px-3 text-xs font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft"
              >
                <FileText className="h-3.5 w-3.5" /> Ticket de ingreso
              </button>
              {open.servicios.length > 0 && (
                <button
                  onClick={() => setRecibo({ ticket: open, tipo: "presupuesto" })}
                  className="flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-full border border-accent/40 px-3 text-xs font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft"
                >
                  <Receipt className="h-3.5 w-3.5" /> Presupuesto
                </button>
              )}
              {["listo", "entregado"].includes(open.estado) && (
                <button
                  onClick={() => setRecibo({ ticket: open, tipo: "egreso" })}
                  className="flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-full border border-accent/40 px-3 text-xs font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft"
                >
                  <FileCheck2 className="h-3.5 w-3.5" /> Ticket de egreso
                </button>
              )}
              <button
                onClick={() => setChecklistEgresoTicket(open)}
                className="flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-full border border-accent/40 px-3 text-xs font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft"
              >
                <ClipboardCheck className="h-3.5 w-3.5" /> Checklist
              </button>
            </div>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => open && eliminarTicket(open.id)}
        title="¿Eliminar ticket?"
        confirmLabel="Eliminar ticket"
      >
        {open && `Se eliminará el ticket #${open.id} (${open.equipo}). Esta acción no se puede deshacer.`}
      </ConfirmDialog>

      <NuevoTicketDialog
        open={creating}
        onClose={() => setCreating(false)}
        clientesOpciones={clientesOpciones}
        tecnicos={tecnicos}
        onCreate={(t) => {
          setList((prev) => [t, ...prev]);
          setCreating(false);
        }}
      />

      <ReciboDialog
        key={recibo ? `${recibo.tipo}-${recibo.ticket.id}` : "none"}
        open={!!recibo}
        onClose={() => setRecibo(null)}
        titulo={
          recibo?.tipo === "presupuesto"
            ? "Presupuesto"
            : recibo?.tipo === "egreso"
              ? "Ticket de egreso"
              : "Ticket de ingreso"
        }
        nro={recibo ? `#${recibo.ticket.id}` : ""}
        fecha={recibo?.ticket.ingreso ?? ""}
        cliente={recibo?.ticket.cliente ?? ""}
        clienteTelefono={
          recibo ? clientesPorId.get(recibo.ticket.clienteId)?.telefono : undefined
        }
        clienteEmail={recibo ? clientesPorId.get(recibo.ticket.clienteId)?.email : undefined}
        negocio={negocio}
        compacto
        sinFirmas={recibo?.tipo === "egreso"}
      >
        {recibo?.tipo === "ingreso" && (
          <>
            <div className="mt-10 print:break-inside-avoid-page">
              <p className="mb-3 border-b border-accent/20 pb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-accent">
                Información del equipo
              </p>
              <div className="grid grid-cols-2 gap-x-8">
                <ReciboCampos
                  className=""
                  variant="inline"
                  separadores
                  filas={[
                    ["Marca", recibo.ticket.marca || "—"],
                    ["Modelo", recibo.ticket.equipo],
                    ["Serial / IMEI", recibo.ticket.imei],
                    ["Color", recibo.ticket.checklistIngreso?.color || "—"],
                  ]}
                />
                <ReciboCampos
                  className=""
                  variant="inline"
                  separadores
                  filas={[
                    ["Reparación solicitada", recibo.ticket.reparacionSolicitada || "—"],
                    ["Falla declarada", recibo.ticket.falla],
                    ["Clave / código", recibo.ticket.claveCodigo || "—"],
                  ]}
                />
              </div>
              <ReciboCampos
                className="mt-3"
                variant="inline"
                filas={[["Observaciones", recibo.ticket.descripcionEquipo || "—"]]}
              />
            </div>
            {recibo.ticket.checklistIngreso && (
              <ReciboChecklist
                titulo="Checklist de ingreso"
                checklist={recibo.ticket.checklistIngreso}
                ocultarColor
              />
            )}
            <ReciboNota
              titulo="Términos y condiciones"
              texto={negocio.reparacionTerminosIngreso}
            />
            {recibo.ticket.servicios.length > 0 && (
              <ReciboLineas
                titulo="Servicios presupuestados"
                lineas={recibo.ticket.servicios.map(lineaDeItem)}
                total={recibo.ticket.presupuestoUsd || undefined}
              />
            )}
            <ReciboNota
              titulo="Aclaraciones"
              texto={negocio.reparacionAclaracionesIngreso}
            />
          </>
        )}
        {recibo?.tipo === "presupuesto" && (
          <>
            <div className="mt-10 print:break-inside-avoid-page">
              <p className="mb-3 border-b border-accent/20 pb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-accent">
                Información del equipo
              </p>
              <div className="grid grid-cols-2 gap-x-8">
                <ReciboCampos
                  className=""
                  variant="inline"
                  separadores
                  filas={[
                    ["Marca", recibo.ticket.marca || "—"],
                    ["Modelo", recibo.ticket.equipo],
                    ["Serial / IMEI", recibo.ticket.imei],
                  ]}
                />
                <ReciboCampos
                  className=""
                  variant="inline"
                  separadores
                  filas={[
                    ["Reparación solicitada", recibo.ticket.reparacionSolicitada || "—"],
                    ["Falla declarada", recibo.ticket.falla],
                    ["Clave / código", recibo.ticket.claveCodigo || "—"],
                  ]}
                />
              </div>
              <ReciboCampos
                className="mt-3"
                variant="inline"
                filas={[["Observaciones", recibo.ticket.descripcionEquipo || "—"]]}
              />
            </div>
            {(() => {
              const servicios = recibo.ticket.servicios.filter(
                (s) => (s.origen ?? "servicio") === "servicio",
              );
              const repuestos = recibo.ticket.servicios.filter((s) => s.origen === "repuesto");
              const libres = recibo.ticket.servicios.filter((s) => s.origen === "libre");
              return (
                <>
                  {servicios.length > 0 && (
                    <ReciboLineas titulo="Servicios" lineas={servicios.map(lineaDeItem)} />
                  )}
                  {repuestos.length > 0 && (
                    <ReciboLineas titulo="Repuestos" lineas={repuestos.map(lineaSinGarantia)} />
                  )}
                  {libres.length > 0 && (
                    <ReciboLineas titulo="Ítems extra" lineas={libres.map(lineaSinGarantia)} />
                  )}
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-accent/20 px-3 py-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Total
                    </span>
                    <span className="font-grotesk text-lg font-semibold tabular-nums">
                      {fmtUsd(recibo.ticket.presupuestoUsd)}
                    </span>
                  </div>
                </>
              );
            })()}
            <ReciboNota
              titulo="Términos y condiciones"
              texto={negocio.reparacionTerminosPresupuesto}
            />
          </>
        )}
        {recibo?.tipo === "egreso" && (
          <>
            <div className="mt-10 print:break-inside-avoid-page">
              <p className="mb-3 border-b border-accent/20 pb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-accent">
                Información del equipo
              </p>
              <div className="grid grid-cols-2 gap-x-8">
                <ReciboCampos
                  className=""
                  variant="inline"
                  separadores
                  filas={[
                    ["Marca", recibo.ticket.marca || "—"],
                    ["Modelo", recibo.ticket.equipo],
                    ["Serial / IMEI", recibo.ticket.imei],
                  ]}
                />
                <ReciboCampos
                  className=""
                  variant="inline"
                  separadores
                  filas={[
                    ["Reparación solicitada", recibo.ticket.reparacionSolicitada || "—"],
                    ["Falla declarada", recibo.ticket.falla],
                    ["Clave / código", recibo.ticket.claveCodigo || "—"],
                  ]}
                />
              </div>
              <ReciboCampos
                className="mt-3"
                variant="inline"
                filas={[["Observaciones", recibo.ticket.descripcionEquipo || "—"]]}
              />
            </div>
            {/* Firmas arriba, en la primera hoja -- el detalle va después
                (por eso el ReciboDialog lleva `sinFirmas`). */}
            <div className="mt-10 print:break-inside-avoid-page">
              <ReciboFirmas negocio={negocio} />
            </div>
            {recibo.ticket.servicios.length > 0 && (
              <ReciboLineas
                titulo="Servicios realizados"
                lineas={recibo.ticket.servicios.map(lineaDeItem)}
                total={recibo.ticket.presupuestoUsd}
              />
            )}
            {recibo.ticket.checklistEgreso && (
              <ReciboChecklist
                titulo="Checklist de egreso"
                checklist={recibo.ticket.checklistEgreso}
              />
            )}
            <ReciboNota
              titulo="Términos y condiciones"
              texto={negocio.reparacionTerminosEgreso}
            />
          </>
        )}
      </ReciboDialog>

      <Dialog
        open={!!checklistEgresoTicket}
        onClose={() => setChecklistEgresoTicket(null)}
        size="lg"
        title={checklistEgresoTicket ? `Checklist de egreso · Ticket #${checklistEgresoTicket.id}` : ""}
        description="Estado del equipo al momento de la entrega."
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => setChecklistEgresoTicket(null)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="w-full sm:w-auto"
              onClick={() =>
                checklistEgresoTicket &&
                guardarChecklistEgreso(
                  checklistEgresoTicket.id,
                  checklistEgresoTicket.checklistEgreso ?? CHECKLIST_VACIO,
                )
              }
            >
              Guardar checklist
            </Button>
          </>
        }
      >
        {checklistEgresoTicket && (
          <ChecklistEditor
            value={checklistEgresoTicket.checklistEgreso ?? CHECKLIST_VACIO}
            onChange={(next) =>
              setChecklistEgresoTicket((t) => (t ? { ...t, checklistEgreso: next } : t))
            }
          />
        )}
      </Dialog>

      <AgregarItemDialog
        ticket={agregandoItemA}
        onClose={() => setAgregandoItemA(null)}
        onAdd={(item) => agregandoItemA && agregarItem(agregandoItemA.id, item)}
        servicios={initialServicios}
        repuestos={repuestos}
      />
    </>
  );
}

/** Agrega un ítem a "Servicios asociados" -- tres orígenes (`Tabs`):
 * catálogo de servicios (precio/garantía fijos), repuesto de inventario
 * (descuenta stock, precio a mano porque `Repuesto` no tiene precio de
 * venta) o libre (nombre + precio a mano, sin ligar a nada). */
function AgregarItemDialog({
  ticket,
  onClose,
  onAdd,
  servicios,
  repuestos,
}: {
  ticket: Ticket | null;
  onClose: () => void;
  onAdd: (item: TicketServicio) => void;
  servicios: Servicio[];
  repuestos: Repuesto[];
}) {
  const [origen, setOrigen] = useState<"servicio" | "repuesto" | "libre">("servicio");
  const [servicioId, setServicioId] = useState("");
  const [repuestoId, setRepuestoId] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [nombre, setNombre] = useState("");
  const [precioUsd, setPrecioUsd] = useState("");
  const [pending, startTransition] = useTransition();

  const activos = useMemo(() => servicios.filter((s) => s.activo), [servicios]);
  const servicioSel = activos.find((s) => s.id === servicioId);
  const repuestoSel = repuestos.find((r) => r.id === repuestoId);

  function reset() {
    setOrigen("servicio");
    setServicioId("");
    setRepuestoId("");
    setCantidad(1);
    setNombre("");
    setPrecioUsd("");
  }

  const puedeGuardar =
    origen === "servicio"
      ? !!servicioSel
      : origen === "repuesto"
        ? !!repuestoSel && cantidad > 0 && cantidad <= repuestoSel.stock && Number(precioUsd) > 0
        : nombre.trim().length > 0 && Number(precioUsd) > 0;

  function submit() {
    if (!puedeGuardar) return;
    const item: TicketServicio =
      origen === "servicio"
        ? {
            origen: "servicio",
            servicioId: servicioSel!.id,
            nombre: servicioSel!.nombre,
            precioUsd: servicioSel!.precioUsd,
            garantiaDias: servicioSel!.garantiaDias,
          }
        : origen === "repuesto"
          ? {
              origen: "repuesto",
              repuestoId: repuestoSel!.id,
              nombre: repuestoSel!.nombre,
              precioUsd: Number(precioUsd),
              cantidad,
            }
          : { origen: "libre", nombre: nombre.trim(), precioUsd: Number(precioUsd) };
    startTransition(() => {
      onAdd(item);
      reset();
    });
  }

  return (
    <Dialog
      open={!!ticket}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Agregar a Servicios asociados"
      description={ticket ? `Ticket #${ticket.id}` : ""}
      footer={
        <>
          <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            className="w-full sm:w-auto"
            disabled={!puedeGuardar || pending}
            onClick={submit}
          >
            {pending ? "Agregando…" : "Agregar"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Origen">
          <Select value={origen} onChange={(e) => setOrigen(e.target.value as typeof origen)}>
            <option value="servicio">Catálogo de servicios</option>
            <option value="repuesto">Repuesto</option>
            <option value="libre">Ítem libre</option>
          </Select>
        </Field>
        {origen === "servicio" && (
          <Field label="Servicio">
            <Select value={servicioId} onChange={(e) => setServicioId(e.target.value)}>
              <option value="">Elegir…</option>
              {activos.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre} · {fmtUsd(s.precioUsd)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {origen === "repuesto" && (
          <>
            <Field label="Repuesto">
              <Select value={repuestoId} onChange={(e) => setRepuestoId(e.target.value)}>
                <option value="">Elegir…</option>
                {repuestos.map((r) => (
                  <option key={r.id} value={r.id} disabled={r.stock <= 0}>
                    {r.nombre} · stock {r.stock}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cantidad">
                <Input
                  type="number"
                  min={1}
                  max={repuestoSel?.stock ?? undefined}
                  value={cantidad}
                  onChange={(e) => setCantidad(Number(e.target.value) || 1)}
                />
              </Field>
              <Field label="Precio a cobrar (USD)">
                <Input
                  type="number"
                  min={0}
                  value={precioUsd}
                  onChange={(e) => setPrecioUsd(e.target.value)}
                  placeholder="0"
                />
              </Field>
            </div>
            {repuestoSel && cantidad > repuestoSel.stock && (
              <p className="text-xs text-red-500">
                No hay stock suficiente (quedan {repuestoSel.stock}).
              </p>
            )}
          </>
        )}
        {origen === "libre" && (
          <>
            <Field label="Nombre">
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </Field>
            <Field label="Precio (USD)">
              <Input
                type="number"
                min={0}
                value={precioUsd}
                onChange={(e) => setPrecioUsd(e.target.value)}
                placeholder="0"
              />
            </Field>
          </>
        )}
      </div>
    </Dialog>
  );
}

function NuevoTicketDialog({
  open,
  onClose,
  onCreate,
  clientesOpciones,
  tecnicos,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (t: Ticket) => void;
  clientesOpciones: ClienteOpcion[];
  tecnicos: { id: string; nombre: string }[];
}) {
  const [cliente, setCliente] = useState<ClienteSeleccion | null>(null);
  const [marca, setMarca] = useState("Apple");
  const [equipo, setEquipo] = useState("");
  const [imei, setImei] = useState("");
  const [falla, setFalla] = useState("");
  const [reparacionSolicitada, setReparacionSolicitada] = useState("");
  const [claveCodigo, setClaveCodigo] = useState("");
  const [descripcionEquipo, setDescripcionEquipo] = useState("");
  const [tecnicoId, setTecnicoId] = useState("");
  const [checklist, setChecklist] = useState<Checklist>(CHECKLIST_VACIO);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!cliente || cliente.tipo === "libre") return;
    startTransition(async () => {
      const ticket = await createTicketAction({
        cliente,
        marca,
        equipo,
        imei,
        falla,
        reparacionSolicitada,
        claveCodigo,
        descripcionEquipo,
        checklistIngreso: checklist,
        tecnicoId: tecnicoId || null,
      });
      onCreate(ticket);
      setCliente(null);
      setMarca("Apple");
      setEquipo("");
      setImei("");
      setFalla("");
      setReparacionSolicitada("");
      setClaveCodigo("");
      setDescripcionEquipo("");
      setTecnicoId("");
      setChecklist(CHECKLIST_VACIO);
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      accent
      title="Nuevo ticket de reparación"
      description="Se crea en estado «Recibido»."
      footer={
        <>
          <button
            onClick={onClose}
            className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50 sm:w-auto"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={!equipo || !falla || !cliente || pending}
            className="flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
          >
            {pending ? "Creando…" : "Crear ticket"}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="space-y-3">
          <Field label="Cliente">
            <ClientePicker clientes={clientesOpciones} value={cliente} onChange={setCliente} />
          </Field>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            Datos del equipo
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Marca">
              <Input value={marca} onChange={(e) => setMarca(e.target.value)} />
            </Field>
            <Field label="Modelo">
              <Input
                value={equipo}
                onChange={(e) => setEquipo(e.target.value)}
                placeholder="iPhone 13 Pro 128GB"
              />
            </Field>
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
            <Field label="Reparación solicitada (opcional)">
              <Input
                value={reparacionSolicitada}
                onChange={(e) => setReparacionSolicitada(e.target.value)}
                placeholder="Ej: Cambio de pantalla"
              />
            </Field>
            <Field label="Clave / código de desbloqueo (opcional)">
              <Input value={claveCodigo} onChange={(e) => setClaveCodigo(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Falla reportada">
              <Textarea
                rows={2}
                value={falla}
                onChange={(e) => setFalla(e.target.value)}
                placeholder="Descripción de la falla…"
              />
            </Field>
            <Field label="Técnico (opcional)">
              <Select value={tecnicoId} onChange={(e) => setTecnicoId(e.target.value)}>
                <option value="">Sin asignar</option>
                {tecnicos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Descripción del equipo (opcional)">
            <Textarea
              rows={2}
              value={descripcionEquipo}
              onChange={(e) => setDescripcionEquipo(e.target.value)}
              placeholder="Golpes, funda, mica, accesorios que trae…"
            />
          </Field>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            Checklist de ingreso
          </p>
          <ChecklistEditor value={checklist} onChange={setChecklist} />
        </div>
      </div>
    </Dialog>
  );
}
