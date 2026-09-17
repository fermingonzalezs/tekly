import "server-only";
import { createServerClient } from "@/lib/auth/supabase";
import type { Pago, Turno, TurnoEstado, TurnoTipo } from "@/lib/types";

/** El mock usaba `dayOffset` (0 = hoy) calculado en el cliente con
 * `new Date()`. La tabla real guarda `fecha` (date real) -- acá se
 * recalcula `dayOffset` server-side para no tocar el contrato de `Turno`
 * que ya consume el client component (la grilla semanal indexa por
 * `dayOffset`, no por fecha). */
function isoHoy(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function isoMasDias(dias: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

function dayOffsetDe(fecha: string): number {
  const hoy = new Date(isoHoy() + "T00:00:00");
  const dia = new Date(fecha + "T00:00:00");
  return Math.round((dia.getTime() - hoy.getTime()) / 86_400_000);
}

type TurnoRow = {
  id: string;
  fecha: string;
  hora: string;
  cliente: string;
  cliente_id: string | null;
  tipo: TurnoTipo;
  estado: TurnoEstado;
  ticket_id: number | null;
  equipo_ids: string[] | null;
  pagos: Pago[] | null;
  nota: string | null;
};

const TURNO_COLS =
  "id, fecha, hora, cliente, cliente_id, tipo, estado, ticket_id, equipo_ids, pagos, nota";

function toTurno(row: TurnoRow): Turno {
  return {
    id: row.id,
    dayOffset: dayOffsetDe(row.fecha),
    hora: row.hora.slice(0, 5),
    cliente: row.cliente,
    clienteId: row.cliente_id,
    tipo: row.tipo,
    estado: row.estado,
    ticketId: row.ticket_id,
    equipoIds: row.equipo_ids ?? undefined,
    pagos: row.pagos ?? undefined,
    nota: row.nota ?? undefined,
  };
}

/** Turnos de los próximos 7 días (hoy a hoy+6), con `dayOffset` calculado
 * para que la grilla semanal del client component funcione sin cambios. */
export async function listTurnosSemana(): Promise<Turno[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("turnos")
    .select(TURNO_COLS)
    .gte("fecha", isoHoy())
    .lte("fecha", isoMasDias(6))
    .order("fecha")
    .order("hora");
  if (error) throw error;
  return (data as unknown as TurnoRow[]).map(toTurno);
}

export async function createTurno(data: {
  dayOffset: number;
  hora: string;
  cliente: string;
  clienteId: string | null;
  tipo: TurnoTipo;
  equipoIds: string[];
  pagos: Pago[];
  nota: string;
}): Promise<Turno> {
  const supabase = createServerClient();
  const { data: row, error } = await supabase
    .from("turnos")
    .insert({
      fecha: isoMasDias(data.dayOffset),
      hora: data.hora,
      cliente: data.cliente,
      cliente_id: data.clienteId,
      tipo: data.tipo,
      estado: "confirmado" satisfies TurnoEstado,
      equipo_ids: data.equipoIds.length ? data.equipoIds : null,
      pagos: data.pagos.length ? data.pagos : null,
      nota: data.nota.trim() || null,
    })
    .select(TURNO_COLS)
    .single();
  if (error) throw error;

  // Mismo criterio que Ventas: "retira" entrega el equipo (vendido), el
  // resto de los turnos con equipo son una reserva. No es una transacción
  // real (supabase-js no las soporta desde el cliente) -- aceptable a esta
  // escala, ver la nota equivalente en lib/db/ventas.ts.
  if (data.equipoIds.length) {
    const nuevoEstado = data.tipo === "retira" ? "vendido" : "reservado";
    const { error: updError } = await supabase
      .from("equipos")
      .update({ estado: nuevoEstado })
      .in("id", data.equipoIds);
    if (updError) throw updError;
  }

  return toTurno(row as unknown as TurnoRow);
}

export async function setTurnoEstado(id: string, estado: TurnoEstado): Promise<Turno> {
  const supabase = createServerClient();
  const { data: row, error } = await supabase
    .from("turnos")
    .update({ estado })
    .eq("id", id)
    .select(TURNO_COLS)
    .single();
  if (error) throw error;
  return toTurno(row as unknown as TurnoRow);
}

export async function deleteTurno(id: string): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase.from("turnos").delete().eq("id", id);
  if (error) throw error;
}
