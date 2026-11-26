import "server-only";
import { createServerClient } from "@/lib/auth/supabase";
import { diasEntre, hoyISO, sumarDias } from "@/lib/date-presets";
import type {
  CelularStatus,
  OtroUnidad,
  Pago,
  Turno,
  TurnoEstado,
  TurnoOtroItem,
  TurnoTipo,
} from "@/lib/types";

function dayOffsetDe(fecha: string): number {
  return diasEntre(hoyISO(), fecha);
}

type TurnoRow = {
  id: string;
  fecha: string;
  hora: string;
  duracion_min: number;
  cliente: string;
  cliente_id: string | null;
  tipo: TurnoTipo;
  estado: TurnoEstado;
  ticket_id: number | null;
  celular_ids: string[] | null;
  items_otros: TurnoOtroItem[] | null;
  pagos: Pago[] | null;
  nota: string | null;
  atiende_id: string | null;
  atiende: { nombre: string } | null;
  tienda_id: string | null;
  tiendas: { nombre: string } | null;
};

const TURNO_COLS =
  "id, fecha, hora, duracion_min, cliente, cliente_id, tipo, estado, ticket_id, celular_ids, items_otros, pagos, nota, atiende_id, atiende:profiles!atiende_id(nombre), tienda_id, tiendas(nombre)";

function toTurno(row: TurnoRow): Turno {
  return {
    id: row.id,
    fecha: row.fecha,
    // `dayOffset` no se persiste: se calcula contra hoy (hora argentina) para
    // los consumidores que ya lo usan (dashboard, analíticas, demo).
    dayOffset: dayOffsetDe(row.fecha),
    hora: row.hora.slice(0, 5),
    duracionMin: row.duracion_min ?? 30,
    cliente: row.cliente,
    clienteId: row.cliente_id,
    tipo: row.tipo,
    estado: row.estado,
    ticketId: row.ticket_id,
    celularIds: row.celular_ids ?? undefined,
    itemsOtros: row.items_otros ?? undefined,
    pagos: row.pagos ?? undefined,
    nota: row.nota ?? undefined,
    atiendeId: row.atiende_id,
    atiende: row.atiende?.nombre ?? null,
    tiendaId: row.tienda_id ?? undefined,
    tienda: row.tiendas?.nombre ?? undefined,
  };
}

/** Turnos de un rango de fechas (`YYYY-MM-DD`, ambos extremos incluidos; un
 * lado vacío es abierto). Lo usan la Agenda (rango visible) y Analíticas >
 * Turnos (historial del período). `dayOffset` sale negativo para turnos
 * pasados, así que quien consuma este listado no debe indexar nada por él.
 * Las fechas del rango las calcula quien llama, en hora argentina (ver
 * `hoyISO`/`presetRange` en lib/date-presets.ts). */
export async function listTurnosRango(desde: string, hasta: string): Promise<Turno[]> {
  const supabase = createServerClient();
  let query = supabase.from("turnos").select(TURNO_COLS).order("fecha").order("hora");
  if (desde) query = query.gte("fecha", desde);
  if (hasta) query = query.lte("fecha", hasta);
  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as TurnoRow[]).map(toTurno);
}

/** Turnos de los próximos 7 días (hoy a hoy+6): lo que consume el Dashboard. */
export async function listTurnosSemana(): Promise<Turno[]> {
  const hoy = hoyISO();
  return listTurnosRango(hoy, sumarDias(hoy, 6));
}

/** Para el panel «Próximos» y los KPIs de la Agenda: los últimos 30 días
 * (para detectar vencidos) más los próximos 14, sin importar la vista que se
 * esté mirando. Quien consume filtra por estado (ver `agruparProximos`). */
export async function listTurnosProximos(): Promise<Turno[]> {
  const hoy = hoyISO();
  return listTurnosRango(sumarDias(hoy, -30), sumarDias(hoy, 14));
}

type TurnoDatos = {
  fecha: string;
  hora: string;
  duracionMin: number;
  atiendeId: string | null;
  /** `null` = la tienda principal. */
  tiendaId: string | null;
  cliente: string;
  clienteId: string | null;
  tipo: TurnoTipo;
  /** Solo "retira": el ticket listo que se viene a retirar (ver
   * `Turno.ticketId`) -- el turno ya no marca celulares como vendidos. */
  ticketId: number | null;
  /** Solo "compra". */
  celularIds: string[];
  /** Solo "compra" -- ítems de "Otros" del carrito. */
  itemsOtros: TurnoOtroItem[];
  pagos: Pago[];
  /** Solo relevante si hay `celularIds`/`itemsOtros`: reservarlos en el stock
   * al agendar (antes era obligatorio, ahora es opcional). */
  reservarStock: boolean;
  nota: string;
};

function columnas(data: TurnoDatos) {
  return {
    fecha: data.fecha,
    hora: data.hora,
    duracion_min: data.duracionMin,
    atiende_id: data.atiendeId,
    tienda_id: data.tiendaId,
    cliente: data.cliente,
    cliente_id: data.clienteId,
    tipo: data.tipo,
    ticket_id: data.ticketId,
    celular_ids: data.celularIds.length ? data.celularIds : null,
    items_otros: data.itemsOtros.length ? data.itemsOtros : null,
    pagos: data.pagos.length ? data.pagos : null,
    nota: data.nota.trim() || null,
  };
}

async function setEstadoCelulares(ids: string[], estado: CelularStatus, soloDesde?: CelularStatus) {
  if (!ids.length) return;
  const supabase = createServerClient();
  let q = supabase.from("celulares").update({ estado }).in("id", ids);
  if (soloDesde) q = q.eq("estado", soloDesde);
  const { error } = await q;
  if (error) throw error;
}

/** Reserva (`reservar = true`) o libera los ítems de "Otros" de un turno. */
async function moverStockOtros(items: TurnoOtroItem[], reservar: boolean) {
  const supabase = createServerClient();
  for (const item of items) {
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
        u.serial === item.serial
          ? { ...u, estado: (reservar ? "reservado" : "disponible") as "reservado" | "disponible" }
          : u,
      );
      const { error } = await supabase
        .from("otros_items")
        .update({ unidades: patched })
        .eq("id", item.otroId);
      if (error) throw error;
    } else if (item.cantidad) {
      // "Otro" no serializado: se descuenta (o repone) de la cantidad total.
      const nueva = reservar
        ? Math.max(0, (otroRow.cantidad ?? 0) - item.cantidad)
        : (otroRow.cantidad ?? 0) + item.cantidad;
      const { error } = await supabase
        .from("otros_items")
        .update({ cantidad: nueva })
        .eq("id", item.otroId);
      if (error) throw error;
    }
  }
}

export async function createTurno(data: TurnoDatos): Promise<Turno> {
  const supabase = createServerClient();
  const { data: row, error } = await supabase
    .from("turnos")
    .insert({ ...columnas(data), estado: "confirmado" satisfies TurnoEstado })
    .select(TURNO_COLS)
    .single();
  if (error) throw error;

  // "retira" ya no toca celulares -- se vincula a un ticket (`Turno.ticketId`)
  // en vez de marcar un equipo "vendido" sin una Venta real detrás. Reservar
  // solo aplica a "compra", y es opcional. Igual que el resto de estos flujos
  // multi-paso (ver `lib/db/ventas.ts`), no es una transacción real.
  if (data.reservarStock) {
    await setEstadoCelulares(data.celularIds, "reservado");
    await moverStockOtros(data.itemsOtros, true);
  }

  return toTurno(row as unknown as TurnoRow);
}

/** Edita un turno. Los celulares/ítems que se quitan vuelven al stock (solo
 * si el turno los había reservado: un celular que ya no está `reservado`
 * -- p. ej. se vendió -- no se toca); los que se suman se reservan si
 * `reservarStock`. */
export async function updateTurno(id: string, data: TurnoDatos): Promise<Turno> {
  const supabase = createServerClient();
  const { data: previo, error: readError } = await supabase
    .from("turnos")
    .select("celular_ids, items_otros")
    .eq("id", id)
    .single();
  if (readError) throw readError;

  const { data: row, error } = await supabase
    .from("turnos")
    .update(columnas(data))
    .eq("id", id)
    .select(TURNO_COLS)
    .single();
  if (error) throw error;

  const antesCel = (previo.celular_ids ?? []) as string[];
  await setEstadoCelulares(
    antesCel.filter((c) => !data.celularIds.includes(c)),
    "disponible",
    "reservado",
  );
  if (data.reservarStock) {
    await setEstadoCelulares(
      data.celularIds.filter((c) => !antesCel.includes(c)),
      "reservado",
    );
  }

  const clave = (i: TurnoOtroItem) => `${i.otroId}|${i.serial ?? ""}`;
  const antesOtros = (previo.items_otros ?? []) as TurnoOtroItem[];
  const quitados = antesOtros.filter((a) => !data.itemsOtros.some((d) => clave(d) === clave(a)));
  const nuevos = data.itemsOtros.filter((d) => !antesOtros.some((a) => clave(a) === clave(d)));
  await moverStockOtros(quitados, false);
  if (data.reservarStock) await moverStockOtros(nuevos, true);

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
