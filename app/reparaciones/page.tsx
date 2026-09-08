"use client";

import { useMemo, useState } from "react";
import { Plus, Wrench, ArrowRight, Check, FileText } from "lucide-react";
import { Section } from "@/components/section";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs } from "@/components/ui/tabs";
import { ServiciosCatalogo } from "@/components/servicios-catalogo";
import { RepairsChart } from "@/components/dashboard/repairs-chart";
import {
  ReciboDialog,
  ReciboCampos,
  ReciboLineas,
} from "@/components/recibos/recibo";
import {
  TICKET_FLOW,
  nextTicketStatus,
  ticketStatus,
} from "@/lib/status";
import { tickets as seed, tecnicos, clientes } from "@/lib/mock-data";
import { fmtUsd } from "@/lib/format";
import { publish } from "@/lib/realtime";
import type { Ticket, TicketStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function ReparacionesPage() {
  const [list, setList] = useState<Ticket[]>(seed);
  const [tecFilter, setTecFilter] = useState("todos");
  const [estFilter, setEstFilter] = useState<"todos" | TicketStatus>("todos");
  const [openId, setOpenId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [vista, setVista] = useState<"tickets" | "servicios">("tickets");
  const [recibo, setRecibo] = useState<Ticket | null>(null);

  const filtered = useMemo(
    () =>
      list.filter(
        (t) =>
          (tecFilter === "todos" ||
            (tecFilter === "sin" ? !t.tecnico : t.tecnico === tecFilter)) &&
          (estFilter === "todos" || t.estado === estFilter),
      ),
    [list, tecFilter, estFilter],
  );

  const open = list.find((t) => t.id === openId) ?? null;

  function advance(id: number) {
    setList((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const next = nextTicketStatus(t.estado);
        return next ? { ...t, estado: next } : t;
      }),
    );
  }

  function setEstado(id: number, estado: TicketStatus) {
    const t = list.find((x) => x.id === id);
    setList((prev) => prev.map((x) => (x.id === id ? { ...x, estado } : x)));
    if (!t) return;
    if (estado === "listo")
      publish({ type: "ticket_ready", actor: "Nico (técnico)", ticket: id, model: t.equipo });
    if (estado === "aprobado")
      publish({
        type: "repair_approved",
        actor: "Caro (ventas)",
        ticket: id,
        amountUsd: t.presupuestoUsd,
      });
  }

  const counts = TICKET_FLOW.map((s) => ({
    s,
    n: list.filter((t) => t.estado === s).length,
  }));

  return (
    <Section title="Reparaciones">
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <Tabs
            value={vista}
            onChange={setVista}
            options={[
              { value: "tickets", label: "Tickets", count: list.length },
              { value: "servicios", label: "Servicios" },
            ]}
          />
          {vista === "tickets" && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Nuevo ticket
            </Button>
          )}
        </div>

        {vista === "servicios" && <ServiciosCatalogo />}

        {vista === "tickets" && (
          <div className="space-y-5">
        {/* pipeline resumen */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
          {counts.map(({ s, n }) => (
            <StatCard
              key={s}
              label={ticketStatus[s].label}
              value={n}
              active={estFilter === s}
              onClick={() => setEstFilter(estFilter === s ? "todos" : s)}
            />
          ))}
        </div>

        {/* filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={tecFilter}
            onChange={(e) => setTecFilter(e.target.value)}
            className="w-52"
          >
            <option value="todos">Todos los técnicos</option>
            <option value="sin">Sin asignar</option>
            {tecnicos.map((t) => (
              <option key={t.id} value={t.alias}>
                {t.alias}
              </option>
            ))}
          </Select>
          <Select
            value={estFilter}
            onChange={(e) =>
              setEstFilter(e.target.value as "todos" | TicketStatus)
            }
            className="w-52"
          >
            <option value="todos">Todos los estados</option>
            {TICKET_FLOW.map((s) => (
              <option key={s} value={s}>
                {ticketStatus[s].label}
              </option>
            ))}
          </Select>
          <span className="ml-auto text-sm text-neutral-400">
            {filtered.length} ticket{filtered.length === 1 ? "" : "s"}
          </span>
        </div>

        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-xs text-neutral-400">
                <th className="px-5 py-3 font-medium">Ticket</th>
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-5 py-3 font-medium">Equipo</th>
                <th className="px-5 py-3 font-medium">Técnico</th>
                <th className="px-5 py-3 font-medium">Presupuesto</th>
                <th className="px-5 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setOpenId(t.id)}
                  className="cursor-pointer border-t border-neutral-100 first:border-t-0 hover:bg-neutral-50"
                >
                  <td className="px-5 py-3 font-medium text-neutral-500">
                    #{t.id}
                    <span className="ml-2 text-xs font-normal text-neutral-400">
                      {t.ingreso}
                    </span>
                  </td>
                  <td className="px-5 py-3">{t.cliente}</td>
                  <td className="px-5 py-3">
                    {t.equipo}
                    <span className="block text-xs text-neutral-400">
                      {t.falla}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {t.tecnico ?? (
                      <span className="text-neutral-400">Sin asignar</span>
                    )}
                  </td>
                  <td className="px-5 py-3 font-semibold">
                    {t.presupuestoUsd ? fmtUsd(t.presupuestoUsd) : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={ticketStatus[t.estado].tone}>
                      {ticketStatus[t.estado].label}
                    </Badge>
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

        <RepairsChart />
          </div>
        )}
      </div>

      {/* Detalle */}
      <Dialog
        open={!!open}
        onClose={() => setOpenId(null)}
        size="lg"
        title={open ? `Ticket #${open.id} · ${open.equipo}` : ""}
        description={open ? `${open.cliente} · ingresó ${open.ingreso}` : ""}
        footer={
          open && (
            <>
              <Button variant="outline" size="sm" onClick={() => setOpenId(null)}>
                Cerrar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRecibo(open)}
              >
                <FileText className="h-4 w-4" /> Recibo de mercadería
              </Button>
              {open.estado !== "aprobado" &&
                ["diagnosticado", "presupuestado"].includes(open.estado) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEstado(open.id, "aprobado")}
                  >
                    <Check className="h-4 w-4" /> Aprobar presupuesto
                  </Button>
                )}
              {open.estado !== "listo" && open.estado !== "entregado" && (
                <Button
                  size="sm"
                  onClick={() =>
                    ["en_reparacion", "esperando_repuesto"].includes(open.estado)
                      ? setEstado(open.id, "listo")
                      : advance(open.id)
                  }
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
                </Button>
              )}
            </>
          )
        }
      >
        {open && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
              <div>
                <span className="text-neutral-400">IMEI </span>
                <span className="font-medium">{open.imei}</span>
              </div>
              <div>
                <span className="text-neutral-400">Técnico </span>
                <span className="font-medium">{open.tecnico ?? "Sin asignar"}</span>
              </div>
              <Badge tone={ticketStatus[open.estado].tone}>
                {ticketStatus[open.estado].label}
              </Badge>
            </div>

            <div>
              <p className="text-xs font-medium text-neutral-400">
                Falla reportada
              </p>
              <p className="mt-1 text-sm">{open.falla}</p>
            </div>

            {/* stepper */}
            <div>
              <p className="mb-2 text-xs font-medium text-neutral-400">
                Progreso
              </p>
              <ol className="flex flex-wrap gap-1.5">
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
              <p className="mb-2 text-xs font-medium text-neutral-400">
                Servicios asociados
              </p>
              <div className="rounded-xl border border-neutral-200">
                {open.servicios.length === 0 && (
                  <p className="px-4 py-3 text-sm text-neutral-400">
                    Sin servicios cargados todavía.
                  </p>
                )}
                {open.servicios.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5 text-sm last:border-b-0"
                  >
                    <span className="flex items-center gap-2">
                      <Wrench className="h-3.5 w-3.5 text-neutral-400" />
                      {s.nombre}
                    </span>
                    <span className="font-semibold">{fmtUsd(s.precioUsd)}</span>
                  </div>
                ))}
                {open.servicios.length > 0 && (
                  <div className="flex items-center justify-between px-4 py-2.5 text-sm font-semibold">
                    <span>Presupuesto total</span>
                    <span>{fmtUsd(open.presupuestoUsd)}</span>
                  </div>
                )}
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

      {/* Nuevo ticket (mock) */}
      <NuevoTicketDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={(t) => {
          setList((prev) => [t, ...prev]);
          setCreating(false);
        }}
        nextId={Math.max(...list.map((t) => t.id)) + 1}
      />

      <ReciboDialog
        key={recibo?.id ?? "none"}
        open={!!recibo}
        onClose={() => setRecibo(null)}
        titulo="Recibo de mercadería"
        nro={recibo ? `#${recibo.id}` : ""}
        fecha={recibo?.ingreso ?? ""}
      >
        {recibo && (
          <>
            <ReciboCampos
              filas={[
                ["Cliente", recibo.cliente],
                ["Equipo", recibo.equipo],
                ["IMEI / Serie", recibo.imei],
                ["Falla declarada", recibo.falla],
                ["Técnico", recibo.tecnico ?? "A asignar"],
              ]}
            />
            {recibo.servicios.length > 0 && (
              <ReciboLineas
                titulo="Servicios presupuestados"
                lineas={recibo.servicios.map((s) => ({
                  detalle: s.nombre,
                  montoUsd: s.precioUsd,
                }))}
                total={recibo.presupuestoUsd || undefined}
              />
            )}
            <p className="mt-5 text-xs text-neutral-500">
              El equipo se recibe para diagnóstico. El presupuesto puede variar
              tras la revisión. Retiro sin reparar: cargo por diagnóstico.
              {recibo.nota ? ` Nota: ${recibo.nota}` : ""}
            </p>
          </>
        )}
      </ReciboDialog>
    </Section>
  );
}

function NuevoTicketDialog({
  open,
  onClose,
  onCreate,
  nextId,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (t: Ticket) => void;
  nextId: number;
}) {
  const [cliente, setCliente] = useState(clientes[0].nombre);
  const [equipo, setEquipo] = useState("");
  const [falla, setFalla] = useState("");
  const [tecnico, setTecnico] = useState("");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Nuevo ticket de reparación"
      description="Se crea en estado «Recibido». Datos mock, no se persisten."
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={!equipo || !falla}
            onClick={() =>
              onCreate({
                id: nextId,
                clienteId:
                  clientes.find((c) => c.nombre === cliente)?.id ?? "c-1",
                cliente,
                equipo,
                imei: "—",
                falla,
                tecnicoId: null,
                tecnico: tecnico || null,
                estado: "recibido",
                ingreso: "Recién",
                presupuestoUsd: 0,
                servicios: [],
              })
            }
          >
            Crear ticket
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Cliente">
          <Select value={cliente} onChange={(e) => setCliente(e.target.value)}>
            {clientes.map((c) => (
              <option key={c.id}>{c.nombre}</option>
            ))}
          </Select>
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
          <Select value={tecnico} onChange={(e) => setTecnico(e.target.value)}>
            <option value="">Sin asignar</option>
            {tecnicos.map((t) => (
              <option key={t.id}>{t.alias}</option>
            ))}
          </Select>
        </Field>
      </div>
    </Dialog>
  );
}
