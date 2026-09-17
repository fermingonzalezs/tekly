"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Plus,
  Wrench,
  ArrowRight,
  Check,
  FileText,
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs } from "@/components/ui/tabs";
import { ClientePicker } from "@/components/ui/cliente-picker";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { ServiciosCatalogo } from "@/components/servicios-catalogo";
import { RepairsChart } from "@/components/dashboard/repairs-chart";
import { ReparacionesSplit } from "@/components/dashboard/reparaciones-split";
import {
  ReciboDialog,
  ReciboCampos,
  ReciboLineas,
} from "@/components/recibos/recibo";
import {
  TICKET_FLOW,
  nextTicketStatus,
  ticketStatus,
  dotClass,
} from "@/lib/status";
import { fmtUsd } from "@/lib/format";
import { useRealtime } from "@/components/notifications/realtime-provider";
import type { ClienteOpcion, ClienteSeleccion, Servicio, Ticket, TicketStatus } from "@/lib/types";
import type { Negocio } from "@/lib/db/configuracion";
import type { SessionUser } from "@/lib/auth/types";
import { cn } from "@/lib/utils";
import { filterPill, thDivider } from "@/lib/ui-styles";
import { DATE_PRESETS, presetRange, type DatePreset } from "@/lib/date-presets";
import {
  createTicketAction,
  saveServicioAction,
  setTicketEstadoAction,
  deleteTicketAction,
} from "./actions";

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
  tecnicos,
  clientesOpciones,
  negocio,
  user,
}: {
  initialTickets: Ticket[];
  initialServicios: Servicio[];
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
  const [creating, setCreating] = useState(false);
  const [vista, setVista] = useState<"tickets" | "servicios">("tickets");
  const [recibo, setRecibo] = useState<{
    ticket: Ticket;
    tipo: "mercaderia" | "presupuesto" | "entrega";
  } | null>(null);
  const [chartsOpen, setChartsOpen] = useState(true);
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
    setList((prev) => prev.filter((t) => t.id !== id));
    setOpenId(null);
    startTransition(async () => {
      await deleteTicketAction(id);
    });
  }

  function advance(id: number) {
    const t = list.find((x) => x.id === id);
    if (!t) return;
    const next = nextTicketStatus(t.estado);
    if (next) aplicarEstado(id, next);
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

        {/* pipeline resumen: siempre visible */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
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
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            value={vista}
            onChange={setVista}
            options={[
              { value: "tickets", label: "Tickets", count: list.length },
              { value: "servicios", label: "Servicios" },
            ]}
          />
          {vista === "tickets" && (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por cliente, equipo o IMEI…"
                  className={cn("w-64 pl-9", filterPill)}
                />
              </div>
              <Select
                value={tecFilter}
                onChange={(e) => setTecFilter(e.target.value)}
                className={cn("w-52", filterPill)}
              >
                <option value="todos">Todos los técnicos</option>
                <option value="sin">Sin asignar</option>
                {tecnicos.map((t) => (
                  <option key={t.id} value={t.nombre}>
                    {t.nombre}
                  </option>
                ))}
              </Select>
              <Select
                value={estFilter}
                onChange={(e) =>
                  setEstFilter(e.target.value as "todos" | TicketStatus)
                }
                className={cn("w-52", filterPill)}
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
          <Card className="overflow-hidden">
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
                <ConfirmButton
                  label="Eliminar ticket"
                  onConfirm={() => eliminarTicket(open.id)}
                  className="mr-auto"
                />
              )}
              <button
                onClick={() => setOpenId(null)}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
              >
                Cerrar
              </button>
              <button
                onClick={() => setRecibo({ ticket: open, tipo: "mercaderia" })}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-accent/40 px-4 text-sm font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft"
              >
                <FileText className="h-4 w-4" /> Recibo de mercadería
              </button>
              {open.servicios.length > 0 && (
                <button
                  onClick={() => setRecibo({ ticket: open, tipo: "presupuesto" })}
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-accent/40 px-4 text-sm font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft"
                >
                  <FileText className="h-4 w-4" /> Presupuesto
                </button>
              )}
              {["listo", "entregado"].includes(open.estado) && (
                <button
                  onClick={() => setRecibo({ ticket: open, tipo: "entrega" })}
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-accent/40 px-4 text-sm font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft"
                >
                  <FileText className="h-4 w-4" /> Recibo de entrega
                </button>
              )}
              {open.estado !== "aprobado" &&
                ["diagnosticado", "presupuestado"].includes(open.estado) && (
                  <button
                    onClick={() => aplicarEstado(open.id, "aprobado")}
                    className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-accent/40 px-4 text-sm font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft"
                  >
                    <Check className="h-4 w-4" /> Aprobar presupuesto
                  </button>
                )}
              {open.estado !== "listo" && open.estado !== "entregado" && (
                <button
                  onClick={() =>
                    ["en_reparacion", "esperando_repuesto"].includes(open.estado)
                      ? aplicarEstado(open.id, "listo")
                      : advance(open.id)
                  }
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent/90"
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
          <div className="space-y-5">
            <div>
              <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Información general
              </p>
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-3 text-center">
                  <p className="font-grotesk border-b border-neutral-300 pb-0.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                    IMEI
                  </p>
                  <p className="mt-2 truncate text-sm font-normal text-neutral-600">
                    {open.imei}
                  </p>
                </Card>
                <Card className="p-3 text-center">
                  <p className="font-grotesk border-b border-neutral-300 pb-0.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                    Técnico
                  </p>
                  <p className="mt-2 truncate text-sm font-normal text-neutral-600">
                    {open.tecnico ?? "Sin asignar"}
                  </p>
                </Card>
                <Card className="p-3 text-center">
                  <p className="font-grotesk border-b border-neutral-300 pb-0.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                    Estado
                  </p>
                  <div className="mt-2 flex justify-center">
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
              </div>
            </div>

            <div>
              <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Falla reportada
              </p>
              <p className="text-sm">{open.falla}</p>
            </div>

            {/* stepper */}
            <div>
              <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
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
              <p className="mb-2 border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Servicios asociados
              </p>
              <div className="overflow-hidden rounded-xl border border-neutral-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className={cn("px-4 py-2 text-start", thDivider)}>
                        Servicio
                      </th>
                      <th className="px-4 py-2 text-end">Precio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {open.servicios.length === 0 ? (
                      <tr>
                        <td
                          colSpan={2}
                          className="px-4 py-3 text-center text-neutral-400"
                        >
                          Sin servicios cargados todavía.
                        </td>
                      </tr>
                    ) : (
                      <>
                        {open.servicios.map((s, i) => (
                          <tr key={i}>
                            <td className="px-4 py-2.5 text-start">
                              <span className="flex items-center gap-2">
                                <Wrench className="h-3.5 w-3.5 text-neutral-400" />
                                {s.nombre}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-end font-medium tabular-nums">
                              {fmtUsd(s.precioUsd)}
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
                          <td className="px-4 py-2.5 text-start uppercase tracking-wide">
                            Presupuesto total
                          </td>
                          <td className="px-4 py-2.5 text-end tabular-nums">
                            {fmtUsd(open.presupuestoUsd)}
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {open.nota && (
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
                {open.nota}
              </div>
            )}
          </div>
        )}
      </Dialog>

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
            : recibo?.tipo === "entrega"
              ? "Recibo de entrega"
              : "Recibo de mercadería"
        }
        nro={recibo ? `#${recibo.ticket.id}` : ""}
        fecha={recibo?.ticket.ingreso ?? ""}
        cliente={recibo?.ticket.cliente ?? ""}
        negocio={negocio}
      >
        {recibo?.tipo === "mercaderia" && (
          <>
            <ReciboCampos
              filas={[
                ["Equipo", recibo.ticket.equipo],
                ["IMEI / Serie", recibo.ticket.imei],
                ["Falla declarada", recibo.ticket.falla],
                ["Técnico", recibo.ticket.tecnico ?? "A asignar"],
              ]}
            />
            {recibo.ticket.servicios.length > 0 && (
              <ReciboLineas
                titulo="Servicios presupuestados"
                lineas={recibo.ticket.servicios.map((s) => ({
                  detalle: s.nombre,
                  montoUsd: s.precioUsd,
                }))}
                total={recibo.ticket.presupuestoUsd || undefined}
              />
            )}
            <p className="mt-5 text-xs text-neutral-500">
              El equipo se recibe para diagnóstico. El presupuesto puede variar
              tras la revisión. Retiro sin reparar: cargo por diagnóstico.
              {recibo.ticket.nota ? ` Nota: ${recibo.ticket.nota}` : ""}
            </p>
          </>
        )}
        {recibo?.tipo === "presupuesto" && (
          <>
            <ReciboCampos
              filas={[
                ["Equipo", recibo.ticket.equipo],
                ["IMEI / Serie", recibo.ticket.imei],
                ["Técnico", recibo.ticket.tecnico ?? "A asignar"],
              ]}
            />
            <ReciboLineas
              titulo="Servicios presupuestados"
              lineas={recibo.ticket.servicios.map((s) => ({
                detalle: s.nombre,
                montoUsd: s.precioUsd,
              }))}
              total={recibo.ticket.presupuestoUsd}
            />
            <p className="mt-5 text-xs text-neutral-500">
              Presupuesto válido por 15 días. Sujeto a modificación si surgen
              fallas adicionales durante la reparación.
            </p>
          </>
        )}
        {recibo?.tipo === "entrega" && (
          <>
            <ReciboCampos
              filas={[
                ["Equipo", recibo.ticket.equipo],
                ["IMEI / Serie", recibo.ticket.imei],
                ["Técnico", recibo.ticket.tecnico ?? "A asignar"],
              ]}
            />
            {recibo.ticket.servicios.length > 0 && (
              <ReciboLineas
                titulo="Servicios realizados"
                lineas={recibo.ticket.servicios.map((s) => ({
                  detalle: s.nombre,
                  montoUsd: s.precioUsd,
                }))}
                total={recibo.ticket.presupuestoUsd}
              />
            )}
            <p className="mt-5 text-xs text-neutral-500">
              El cliente retira el equipo conforme, habiendo verificado su
              funcionamiento. Garantía de la reparación: 90 días.
            </p>
          </>
        )}
      </ReciboDialog>
    </>
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
  const [equipo, setEquipo] = useState("");
  const [falla, setFalla] = useState("");
  const [tecnicoId, setTecnicoId] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!cliente || cliente.tipo === "libre") return;
    startTransition(async () => {
      const ticket = await createTicketAction({
        cliente,
        equipo,
        falla,
        tecnicoId: tecnicoId || null,
      });
      onCreate(ticket);
      setCliente(null);
      setEquipo("");
      setFalla("");
      setTecnicoId("");
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Nuevo ticket de reparación"
      description="Se crea en estado «Recibido»."
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={!equipo || !falla || !cliente || pending}
            onClick={submit}
          >
            {pending ? "Creando…" : "Crear ticket"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Cliente">
          <ClientePicker clientes={clientesOpciones} value={cliente} onChange={setCliente} />
        </Field>
        <Field label="Equipo">
          <Input
            value={equipo}
            onChange={(e) => setEquipo(e.target.value)}
            placeholder="iPhone 13 Pro 128GB"
          />
        </Field>
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
    </Dialog>
  );
}
