"use client";

import { useMemo, useState } from "react";
import { Link2, Check, X } from "lucide-react";
import { Section } from "@/components/section";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { turnoTipo, turnoStatus, dotClass } from "@/lib/status";
import { turnos as seed } from "@/lib/mock-data";
import { publish } from "@/lib/realtime";
import { cn } from "@/lib/utils";
import { thDivider } from "@/lib/ui-styles";
import type { Turno, TurnoTipo } from "@/lib/types";

const HORAS = Array.from({ length: 23 }, (_, i) => {
  const min = 9 * 60 + i * 30;
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(
    min % 60,
  ).padStart(2, "0")}`;
}); // 09:00 … 20:00 cada 30 min
const DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const TIPOS: TurnoTipo[] = ["compra", "deja", "retira", "cotizar"];

const ZEBRA_STRIPES =
  "repeating-linear-gradient(45deg, rgba(0,0,0,0.025) 0 4px, rgba(0,0,0,0) 4px 8px)";

type ChipState = "normal" | "highlight" | "hidden";

export default function TurnosPage() {
  const [list, setList] = useState<Turno[]>(seed);
  const [sel, setSel] = useState<Turno | null>(null);
  const [slot, setSlot] = useState<{ dayOffset: number; hora: string } | null>(
    null,
  );
  const [tipoState, setTipoState] = useState<Record<TurnoTipo, ChipState>>(
    () =>
      Object.fromEntries(TIPOS.map((t) => [t, "normal"])) as Record<
        TurnoTipo,
        ChipState
      >,
  );

  function cycleTipo(tp: TurnoTipo) {
    setTipoState((prev) => {
      const cur = prev[tp];
      const next: ChipState =
        cur === "normal" ? "highlight" : cur === "highlight" ? "hidden" : "normal";
      return { ...prev, [tp]: next };
    });
  }

  const anyHighlighted = TIPOS.some((tp) => tipoState[tp] === "highlight");

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
        {/* Referencia de colores: click resalta, click de nuevo oculta, click de nuevo vuelve a normal */}
        <div className="flex flex-wrap items-center gap-2">
          {TIPOS.map((tp) => {
            const state = tipoState[tp];
            return (
              <button
                key={tp}
                onClick={() => cycleTipo(tp)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
                  state === "hidden" &&
                    "bg-neutral-50 text-neutral-300 line-through",
                  state === "highlight" &&
                    "bg-accent-soft text-accent ring-1 ring-inset ring-accent/30",
                  state === "normal" &&
                    "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    state === "hidden"
                      ? "bg-neutral-300"
                      : dotClass[turnoTipo[tp].tone],
                  )}
                />
                {turnoTipo[tp].label}
              </button>
            );
          })}
          <span className="ml-auto text-xs text-neutral-400">
            Próximos 7 días · 09 a 20 h · tocá un hueco para agendar
          </span>
        </div>

        <Card className="overflow-x-auto p-0">
          <div className="min-w-[760px]">
            {/* Encabezado de días */}
            <div
              className="grid bg-[#352f86]"
              style={{ gridTemplateColumns: "3.25rem repeat(7, 1fr)" }}
            >
              <div className="flex items-center justify-center text-[10px] font-bold uppercase tracking-wide text-white/50">
                Hora
              </div>
              {days.map((d, i) => (
                <div
                  key={i}
                  className={cn(
                    "px-2 py-2 text-center",
                    i < 6 && thDivider,
                    i === 0 && "bg-white/10",
                  )}
                >
                  <p className="text-[11px] font-bold uppercase tracking-wide text-white/60">
                    {DOW[d.getDay()]}
                  </p>
                  <p className="text-sm font-semibold text-white">
                    {d.getDate()} {MES[d.getMonth()]}
                  </p>
                </div>
              ))}
            </div>

            {/* Filas de horas */}
            {HORAS.map((h, hi) => (
              <div
                key={h}
                className="grid border-b border-neutral-100 last:border-b-0"
                style={{
                  gridTemplateColumns: "3.25rem repeat(7, 1fr)",
                  backgroundImage: hi % 2 === 1 ? ZEBRA_STRIPES : undefined,
                }}
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
                  if (tipoState[t.tipo] === "hidden")
                    return (
                      <div
                        key={dayOffset}
                        className="min-h-[46px] border-l border-neutral-100"
                      />
                    );
                  const dimmed =
                    anyHighlighted && tipoState[t.tipo] !== "highlight";
                  return (
                    <div
                      key={dayOffset}
                      className="border-l border-neutral-100 p-1"
                    >
                      <button
                        onClick={() => setSel(t)}
                        className={cn(
                          "flex h-full w-full items-start gap-1.5 rounded-md bg-neutral-100 px-2 py-1.5 text-left transition-colors hover:bg-neutral-200",
                          t.estado === "cancelado" && "line-through opacity-50",
                          dimmed && "opacity-30",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                            dotClass[turnoTipo[t.tipo].tone],
                          )}
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold text-neutral-900">
                            {t.cliente}
                          </span>
                          <span className="block truncate text-[11px] text-neutral-500">
                            {turnoTipo[t.tipo].label}
                          </span>
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
              <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    dotClass[turnoTipo[sel.tipo].tone],
                  )}
                />
                {turnoTipo[sel.tipo].label}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    dotClass[turnoStatus[sel.estado].tone],
                  )}
                />
                {turnoStatus[sel.estado].label}
              </span>
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
