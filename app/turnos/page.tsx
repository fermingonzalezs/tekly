"use client";

import { useMemo, useState } from "react";
import { Link2, Check, X } from "lucide-react";
import { Section } from "@/components/section";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { turnoTipo, turnoStatus, type Tone } from "@/lib/status";
import { turnos as seed } from "@/lib/mock-data";
import { publish } from "@/lib/realtime";
import { cn } from "@/lib/utils";
import type { Turno, TurnoTipo } from "@/lib/types";

const HORAS = Array.from(
  { length: 12 },
  (_, i) => `${String(9 + i).padStart(2, "0")}:00`,
); // 09:00 … 20:00
const DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const TIPOS: TurnoTipo[] = ["compra", "deja", "retira", "cotizar"];

const blockClass: Record<Tone, string> = {
  green: "bg-emerald-100 text-emerald-800 ring-emerald-600/20 hover:bg-emerald-200",
  blue: "bg-blue-100 text-blue-800 ring-blue-600/20 hover:bg-blue-200",
  violet: "bg-violet-100 text-violet-800 ring-violet-600/20 hover:bg-violet-200",
  amber: "bg-amber-100 text-amber-800 ring-amber-600/20 hover:bg-amber-200",
  gray: "bg-neutral-100 text-neutral-700 ring-neutral-500/20 hover:bg-neutral-200",
  red: "bg-red-100 text-red-800 ring-red-600/20 hover:bg-red-200",
};

export default function TurnosPage() {
  const [list, setList] = useState<Turno[]>(seed);
  const [sel, setSel] = useState<Turno | null>(null);
  const [slot, setSlot] = useState<{ dayOffset: number; hora: string } | null>(
    null,
  );

  const days = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

  const at = (dayOffset: number, hora: string) =>
    list.find((t) => t.dayOffset === dayOffset && t.hora === hora);

  function llego(t: Turno) {
    setList((p) => p.map((x) => (x.id === t.id ? { ...x, estado: "llego" } : x)));
    setSel(null);
    if (t.ticketId)
      publish({
        type: "appointment_arrived",
        actor: "Meli (ventas)",
        client: t.cliente,
        ticket: t.ticketId,
      });
  }

  function cancelar(t: Turno) {
    setList((p) =>
      p.map((x) => (x.id === t.id ? { ...x, estado: "cancelado" } : x)),
    );
    setSel(null);
  }

  function agendar(data: { cliente: string; tipo: TurnoTipo }) {
    if (!slot) return;
    setList((p) => [
      ...p,
      {
        id: `t-${Date.now()}`,
        dayOffset: slot.dayOffset,
        hora: slot.hora,
        cliente: data.cliente,
        tipo: data.tipo,
        estado: "confirmado",
        ticketId: null,
      },
    ]);
    setSlot(null);
  }

  const dayLabel = (o: number) =>
    `${DOW[days[o].getDay()]} ${days[o].getDate()} ${MES[days[o].getMonth()]}`;

  return (
    <Section title="Turnos">
      <div className="space-y-4">
        {/* Referencia de colores */}
        <div className="flex flex-wrap items-center gap-2">
          {TIPOS.map((tp) => (
            <span
              key={tp}
              className={cn(
                "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                blockClass[turnoTipo[tp].tone],
              )}
            >
              {turnoTipo[tp].label}
            </span>
          ))}
          <span className="ml-auto text-xs text-neutral-400">
            Próximos 7 días · 09 a 20 h · tocá un hueco para agendar
          </span>
        </div>

        <Card className="overflow-x-auto p-0">
          <div className="min-w-[760px]">
            {/* Encabezado de días */}
            <div
              className="grid border-b border-neutral-200 bg-accent-soft"
              style={{ gridTemplateColumns: "3.25rem repeat(7, 1fr)" }}
            >
              <div />
              {days.map((d, i) => (
                <div
                  key={i}
                  className={cn(
                    "border-l border-neutral-200 px-2 py-2 text-center",
                    i === 0 && "bg-accent/10",
                  )}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                    {DOW[d.getDay()]}
                  </p>
                  <p className="text-sm font-semibold text-neutral-800">
                    {d.getDate()} {MES[d.getMonth()]}
                  </p>
                </div>
              ))}
            </div>

            {/* Filas de horas */}
            {HORAS.map((h) => (
              <div
                key={h}
                className="grid border-b border-neutral-100 last:border-b-0"
                style={{ gridTemplateColumns: "3.25rem repeat(7, 1fr)" }}
              >
                <div className="py-2 pr-2 text-right text-[11px] font-medium tabular-nums text-neutral-400">
                  {h}
                </div>
                {days.map((_, dayOffset) => {
                  const t = at(dayOffset, h);
                  if (!t)
                    return (
                      <button
                        key={dayOffset}
                        onClick={() => setSlot({ dayOffset, hora: h })}
                        className="min-h-[46px] border-l border-neutral-100 transition-colors hover:bg-accent-soft"
                      />
                    );
                  return (
                    <div
                      key={dayOffset}
                      className="border-l border-neutral-100 p-1"
                    >
                      <button
                        onClick={() => setSel(t)}
                        className={cn(
                          "block h-full w-full rounded-md px-2 py-1.5 text-left ring-1 ring-inset transition-colors",
                          blockClass[turnoTipo[t.tipo].tone],
                          t.estado === "cancelado" && "line-through opacity-50",
                        )}
                      >
                        <span className="block truncate text-xs font-semibold">
                          {t.cliente}
                        </span>
                        <span className="block truncate text-[11px] opacity-80">
                          {turnoTipo[t.tipo].label}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Detalle de turno */}
      <Dialog
        open={!!sel}
        onClose={() => setSel(null)}
        title={sel ? sel.cliente : ""}
        description={sel ? `${dayLabel(sel.dayOffset)} · ${sel.hora}` : ""}
        footer={
          sel && (
            <>
              <Button variant="outline" size="sm" onClick={() => setSel(null)}>
                Cerrar
              </Button>
              {sel.estado !== "cancelado" && sel.estado !== "llego" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => cancelar(sel)}
                  >
                    <X className="h-4 w-4" /> Cancelar turno
                  </Button>
                  <Button size="sm" onClick={() => llego(sel)}>
                    <Check className="h-4 w-4" /> Cliente llegó
                  </Button>
                </>
              )}
            </>
          )
        }
      >
        {sel && (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge tone={turnoTipo[sel.tipo].tone}>
                {turnoTipo[sel.tipo].label}
              </Badge>
              <Badge tone={turnoStatus[sel.estado].tone}>
                {turnoStatus[sel.estado].label}
              </Badge>
            </div>
            {sel.ticketId ? (
              <p className="inline-flex items-center gap-1.5 text-accent">
                <Link2 className="h-4 w-4" /> Vinculado al ticket #{sel.ticketId}
              </p>
            ) : (
              <p className="text-neutral-400">Sin ticket vinculado.</p>
            )}
          </div>
        )}
      </Dialog>

      {/* Agendar turno */}
      <AgendarDialog
        key={slot ? `${slot.dayOffset}-${slot.hora}` : "none"}
        slot={slot}
        dayLabel={slot ? `${dayLabel(slot.dayOffset)} · ${slot.hora}` : ""}
        onClose={() => setSlot(null)}
        onSubmit={agendar}
      />
    </Section>
  );
}

function AgendarDialog({
  slot,
  dayLabel,
  onClose,
  onSubmit,
}: {
  slot: { dayOffset: number; hora: string } | null;
  dayLabel: string;
  onClose: () => void;
  onSubmit: (d: { cliente: string; tipo: TurnoTipo }) => void;
}) {
  const [cliente, setCliente] = useState("");
  const [tipo, setTipo] = useState<TurnoTipo>("cotizar");

  return (
    <Dialog
      open={!!slot}
      onClose={onClose}
      title="Agendar turno"
      description={dayLabel}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={!cliente.trim()}
            onClick={() => onSubmit({ cliente: cliente.trim(), tipo })}
          >
            Agendar
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Cliente">
          <Input
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            placeholder="Nombre del cliente"
          />
        </Field>
        <Field label="Motivo">
          <Select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TurnoTipo)}
          >
            {TIPOS.map((tp) => (
              <option key={tp} value={tp}>
                {turnoTipo[tp].label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Dialog>
  );
}
