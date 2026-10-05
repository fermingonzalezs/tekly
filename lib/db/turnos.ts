import "server-only";
import { createServerClient } from "@/lib/auth/supabase";
import type {
  EquipoStatus,
  OtroUnidad,
  Pago,
  Turno,
  TurnoEstado,
  TurnoOtroItem,
  TurnoTipo,
} from "@/lib/types";

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
  items_otros: TurnoOtroItem[] | null;
  pagos: Pago[] | null;
  nota: string | null;
};

const TURNO_COLS =
  "id, fecha, hora, cliente, cliente_id, tipo, estado, ticket_id, equipo_ids, items_otros, pagos, nota";

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
    itemsOtros: row.items_otros ?? undefined,
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

/** Turnos de un rango de fechas (`YYYY-MM-DD`, ambos extremos incluidos; un
 * lado vacío es abierto). Es lo que usa Analíticas > Turnos para medir el
 * historial del período -- `listTurnosSemana` solo mira los próximos 7 días,
 * que todavía no pasaron. Ojo: `dayOffset` sale negativo para turnos
 * pasados (el contrato original de 0..6 es solo de la grilla semanal), así
 * que quien consuma este listado no debe indexar nada por `dayOffset`.
 * Las fechas del rango las calcula quien llama, en hora argentina (ver
 * `presetRange` en lib/date-presets.ts). */
export async function listTurnosRango(desde: string, hasta: string): Promise<Turno[]> {
  const supabase = createServerClient();
  let query = supabase.from("turnos").select(TURNO_COLS).order("fecha").order("hora");
  if (desde) query = query.gte("fecha", desde);
  if (hasta) query = query.lte("fecha", hasta);
  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as TurnoRow[]).map(toTurno);
}

export async function createTurno(data: {
  dayOffset: number;
  hora: string;
  cliente: string;
  clienteId: string | null;
  tipo: TurnoTipo;
  /** Solo "retira": el ticket listo que se viene a retirar (ver
   * `Turno.ticketId`) -- el turno ya no marca equipos como vendidos. */
  ticketId: number | null;
  /** Solo "compra". */
  equipoIds: string[];
  /** Solo "compra" -- ítems de "Otros" del carrito. */
  itemsOtros: TurnoOtroItem[];
  pagos: Pago[];
  /** Solo relevante si hay `equipoIds`/`itemsOtros`: reservarlos en el stock
   * al agendar (antes era obligatorio, ahora es opcional). */
  reservarStock: boolean;
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
      ticket_id: data.ticketId,
      equipo_ids: data.equipoIds.length ? data.equipoIds : null,
      items_otros: data.itemsOtros.length ? data.itemsOtros : null,
      pagos: data.pagos.length ? data.pagos : null,
      nota: data.nota.trim() || null,
    })
    .select(TURNO_COLS)
    .single();
  if (error) throw error;

  // "retira" ya no toca equipos -- se vincula a un ticket (`Turno.ticketId`)
  // en vez de marcar un equipo "vendido" sin una Venta real detrás (bug que
  // tenía este flujo). Reservar solo aplica a "compra", y es opcional.
  // Igual que el resto de estos flujos multi-paso (ver nota equivalente en
  // `lib/db/ventas.ts`), no es una transacción real -- aceptable a esta
  // escala. Tampoco hay reversión automática al cancelar/eliminar un turno
  // (gap preexistente: los ítems reservados se quedan reservados).
  if (data.reservarStock && data.equipoIds.length) {
    const { error: updError } = await supabase
      .from("equipos")
      .update({ estado: "reservado" satisfies EquipoStatus })
      .in("id", data.equipoIds);
    if (updError) throw updError;
  }

  if (data.reservarStock && data.itemsOtros.length) {
    for (const item of data.itemsOtros) {
      const { data: otroRow, error: readError } = await supabase
        .from("otros_items")
        .select("serializado, cantidad, unidades")
        .eq("id", item.otroId)
        .single();
      if (readError) throw readError;

      if (item.serial) {
        // Unidad puntual de un "Otro" serializado: se marca `estado` dentro
        // del jsonb `unidades` (no hay tabla de unidades sueltas).
        const unidades = (otroRow.unidades ?? []) as OtroUnidad[];
        const patched = unidades.map((u) =>
          u.serial === item.serial ? { ...u, estado: "reservado" as const } : u,
        );
        const { error: updError } = await supabase
          .from("otros_items")
          .update({ unidades: patched })
          .eq("id", item.otroId);
        if (updError) throw updError;
      } else if (item.cantidad) {
        // "Otro" no serializado: se descuenta de la cantidad total.
        const nuevaCantidad = Math.max(0, (otroRow.cantidad ?? 0) - item.cantidad);
        const { error: updError } = await supabase
          .from("otros_items")
          .update({ cantidad: nuevaCantidad })
          .eq("id", item.otroId);
        if (updError) throw updError;
      }
    }
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
