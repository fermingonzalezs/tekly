import "server-only";
import { createServerClient } from "@/lib/auth/supabase";
import { requireUser } from "@/lib/auth";
import { fmtDayMonth, fmtMonthYear, fmtTime } from "@/lib/format";
import { getNegocio } from "@/lib/db/configuracion";
import type {
  EtiquetaMovimiento,
  Caja,
  CategoriaGasto,
  Conciliacion,
  ConciliacionLinea,
  MedioPago,
  MovimientoCaja,
  Pago,
} from "@/lib/types";

// ─────────────────────────── Cajas ───────────────────────────

type CajaRow = {
  id: string;
  nombre: string;
  moneda: "usd" | "ars";
  activa: boolean;
  descripcion: string | null;
  medio_pago: MedioPago;
  recargo_pct: number | string;
  created_at: string;
};

const CAJA_COLS =
  "id, nombre, moneda, activa, descripcion, medio_pago, recargo_pct, created_at";

function toCaja(row: CajaRow): Caja {
  return {
    id: row.id,
    nombre: row.nombre,
    moneda: row.moneda,
    activa: row.activa,
    descripcion: row.descripcion ?? "",
    creadaEl: fmtMonthYear(row.created_at),
    medioPago: row.medio_pago,
    recargoPct: Number(row.recargo_pct ?? 0),
  };
}

/** Recargo (%) de cada caja por id -- lo usan los servers de Ventas y
 * Reparaciones para no confiar en el que mande el cliente. */
export async function recargosPorCaja(ids: string[]): Promise<Map<string, number>> {
  const unicos = [...new Set(ids.filter(Boolean))];
  if (unicos.length === 0) return new Map();
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("cajas")
    .select("id, recargo_pct")
    .in("id", unicos);
  if (error) throw error;
  return new Map(
    (data as { id: string; recargo_pct: number | string }[]).map((c) => [
      c.id,
      Number(c.recargo_pct ?? 0),
    ]),
  );
}

/** Moneda de cada caja **activa** por id (las inactivas o ajenas no
 * aparecen): para no confiar en la moneda que manda el cliente. */
export async function monedasDeCajasActivas(ids: string[]): Promise<Map<string, "usd" | "ars">> {
  const unicos = [...new Set(ids.filter(Boolean))];
  if (unicos.length === 0) return new Map();
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("cajas")
    .select("id, moneda")
    .eq("activa", true)
    .in("id", unicos);
  if (error) throw error;
  return new Map((data as { id: string; moneda: "usd" | "ars" }[]).map((c) => [c.id, c.moneda]));
}

/** Pisa el `recargoPct` de cada pago con el de **su caja** (o el de cuenta
 * corriente de la organización). Los servers de Ventas/Reparaciones lo usan
 * para no confiar en el % que mande el cliente; el snapshot se guarda en el
 * pago. */
export async function conRecargoDeCaja<T extends Pago>(pagos: T[]): Promise<T[]> {
  const porCaja = await recargosPorCaja(pagos.map((p) => p.cajaId ?? ""));
  const cuentaCorriente = (await getNegocio()).recargosMediosPago.cuenta_corriente;
  return pagos.map((p) => ({
    ...p,
    recargoPct:
      p.medio === "cuenta_corriente"
        ? cuentaCorriente || undefined
        : p.cajaId
          ? porCaja.get(p.cajaId) || undefined
          : undefined,
  })) as T[];
}

export async function listCajas(): Promise<Caja[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase.from("cajas").select(CAJA_COLS).order("created_at");
  if (error) throw error;
  return (data as unknown as CajaRow[]).map(toCaja);
}

export type CajaInput = {
  nombre: string;
  moneda: "usd" | "ars";
  activa: boolean;
  descripcion: string;
  medioPago: MedioPago;
  /** 0–100. */
  recargoPct: number;
};

/** Alta si `id` es `null`, edición si no. */
export async function saveCaja(id: string | null, data: CajaInput): Promise<Caja> {
  const supabase = createServerClient();
  const patch = {
    nombre: data.nombre,
    moneda: data.moneda,
    activa: data.activa,
    descripcion: data.descripcion || null,
    medio_pago: data.medioPago,
    recargo_pct: data.recargoPct,
  };
  const query = id
    ? supabase.from("cajas").update(patch).eq("id", id)
    : supabase.from("cajas").insert(patch);
  const { data: row, error } = await query.select(CAJA_COLS).single();
  if (error) throw error;
  return toCaja(row as unknown as CajaRow);
}

// ─────────────────────────── Movimientos ───────────────────────────

type MovimientoRow = {
  id: string;
  fecha: string;
  concepto: string;
  medio_pago: MedioPago;
  tipo: "ingreso" | "egreso";
  categoria: CategoriaGasto | null;
  caja_id: string;
  monto: number;
  cotizacion: number | null;
  ticket_id: number | null;
  usuario_nombre: string;
  conciliacion_id: string | null;
  etiqueta: EtiquetaMovimiento | null;
};

const MOV_COLS =
  "id, fecha, concepto, medio_pago, tipo, categoria, caja_id, monto, cotizacion, ticket_id, usuario_nombre, conciliacion_id, etiqueta";

function toMovimiento(row: MovimientoRow): MovimientoCaja {
  return {
    id: row.id,
    fecha: fmtDayMonth(row.fecha),
    fechaISO: row.fecha.slice(0, 10),
    hora: fmtTime(row.fecha),
    concepto: row.concepto,
    medioPago: row.medio_pago,
    tipo: row.tipo,
    categoria: row.categoria ?? null,
    cajaId: row.caja_id,
    monto: row.monto,
    cotizacion: row.cotizacion != null ? Number(row.cotizacion) : null,
    ticketId: row.ticket_id ?? null,
    usuario: row.usuario_nombre,
    conciliacionId: row.conciliacion_id ?? null,
    etiqueta: row.etiqueta ?? undefined,
  };
}

/** `soloSinConciliar`: equivalente a `movimientosHoy` del mock (todavía sin
 * archivar bajo ninguna conciliación). Sin la opción, trae todo -- el
 * "Historial" de la tabla. */
export async function listMovimientos(opts?: {
  soloSinConciliar?: boolean;
}): Promise<MovimientoCaja[]> {
  const supabase = createServerClient();
  let query = supabase.from("movimientos_caja").select(MOV_COLS).order("fecha", { ascending: false });
  if (opts?.soloSinConciliar) query = query.is("conciliacion_id", null);
  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as MovimientoRow[]).map(toMovimiento);
}

export async function createMovimiento(data: {
  tipo: "ingreso" | "egreso";
  cajaId: string;
  concepto: string;
  medioPago: MedioPago;
  categoria?: CategoriaGasto | null;
  monto: number;
  /** Dólar del momento en que se confirma el movimiento (ARS por USD).
   * Obligatorio si la caja es en pesos: sin cotización guardada, Analíticas
   * no puede pasar el movimiento a USD sin recurrir al blue de hoy. */
  cotizacion?: number | null;
}): Promise<MovimientoCaja> {
  const user = await requireUser();
  const supabase = createServerClient();

  const { data: caja, error: cajaError } = await supabase
    .from("cajas")
    .select("moneda")
    .eq("id", data.cajaId)
    .single();
  if (cajaError) throw cajaError;
  const cotizacion = data.cotizacion != null && data.cotizacion > 0 ? data.cotizacion : null;
  if (caja.moneda === "ars" && cotizacion == null) {
    throw new Error("Falta la cotización del dólar para registrar un movimiento en una caja en pesos.");
  }

  const { data: row, error } = await supabase
    .from("movimientos_caja")
    .insert({
      caja_id: data.cajaId,
      concepto: data.concepto,
      medio_pago: data.medioPago,
      tipo: data.tipo,
      categoria: data.tipo === "egreso" ? (data.categoria ?? null) : null,
      monto: data.monto,
      cotizacion,
      usuario_id: user.id,
      usuario_nombre: user.nombre,
    })
    .select(MOV_COLS)
    .single();
  if (error) throw error;
  return toMovimiento(row as unknown as MovimientoRow);
}

/** No se puede eliminar un movimiento ya archivado bajo una conciliación
 * (`conciliacion_id` no nulo) -- la diferencia de esa conciliación pasada
 * ya se calculó contra él, borrarlo la desincronizaría en silencio. */
export async function deleteMovimiento(id: string): Promise<void> {
  const supabase = createServerClient();
  const { data: row, error: readError } = await supabase
    .from("movimientos_caja")
    .select("conciliacion_id")
    .eq("id", id)
    .single();
  if (readError) throw readError;
  if (row.conciliacion_id) {
    throw new Error("Ese movimiento ya está conciliado y no se puede eliminar.");
  }

  const { error } = await supabase.from("movimientos_caja").delete().eq("id", id);
  if (error) throw error;
}

// ─────────────────────────── Conciliaciones ───────────────────────────

type ConciliacionRow = {
  id: string;
  fecha: string;
  responsable_nombre: string;
  lineas: ConciliacionLinea[];
  comentario: string | null;
};

const CONC_COLS = "id, fecha, responsable_nombre, lineas, comentario";

function toConciliacion(row: ConciliacionRow): Conciliacion {
  return {
    id: row.id,
    fecha: fmtDayMonth(row.fecha),
    hora: fmtTime(row.fecha),
    responsable: row.responsable_nombre,
    lineas: row.lineas,
    comentario: row.comentario ?? undefined,
  };
}

export async function listConciliaciones(): Promise<Conciliacion[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("conciliaciones")
    .select(CONC_COLS)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return (data as unknown as ConciliacionRow[]).map(toConciliacion);
}

/** Crea la conciliación y archiva bajo ella todos los movimientos que
 * todavía no estaban conciliados -- "arranca vacío" sin borrar nada (a
 * diferencia del mock, que movía `movimientosHoy` a `movimientosPrevios`).
 * Dos llamadas separadas, no atómico (mismo trade-off ya documentado en
 * `lib/db/ventas.ts`). */
export async function crearConciliacion(
  lineas: ConciliacionLinea[],
  comentario?: string,
): Promise<Conciliacion> {
  const user = await requireUser();
  const supabase = createServerClient();
  const { data: row, error } = await supabase
    .from("conciliaciones")
    .insert({
      responsable_id: user.id,
      responsable_nombre: user.nombre,
      lineas,
      comentario: comentario?.trim() || null,
    })
    .select(CONC_COLS)
    .single();
  if (error) throw error;

  const { error: updError } = await supabase
    .from("movimientos_caja")
    .update({ conciliacion_id: row.id })
    .is("conciliacion_id", null);
  if (updError) throw updError;

  return toConciliacion(row as unknown as ConciliacionRow);
}
