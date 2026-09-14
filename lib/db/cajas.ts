import "server-only";
import { createServerClient } from "@/lib/auth/supabase";
import { requireUser } from "@/lib/auth";
import { fmtDayMonth, fmtMonthYear, fmtTime } from "@/lib/format";
import type { Caja, Conciliacion, ConciliacionLinea, MedioPago, MovimientoCaja } from "@/lib/types";

// ─────────────────────────── Cajas ───────────────────────────

type CajaRow = {
  id: string;
  nombre: string;
  moneda: "usd" | "ars";
  activa: boolean;
  descripcion: string | null;
  medio_pago: MedioPago;
  created_at: string;
};

const CAJA_COLS = "id, nombre, moneda, activa, descripcion, medio_pago, created_at";

function toCaja(row: CajaRow): Caja {
  return {
    id: row.id,
    nombre: row.nombre,
    moneda: row.moneda,
    activa: row.activa,
    descripcion: row.descripcion ?? "",
    creadaEl: fmtMonthYear(row.created_at),
    medioPago: row.medio_pago,
  };
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
  caja_id: string;
  monto: number;
  usuario_nombre: string;
  conciliacion_id: string | null;
};

const MOV_COLS =
  "id, fecha, concepto, medio_pago, tipo, caja_id, monto, usuario_nombre, conciliacion_id";

function toMovimiento(row: MovimientoRow): MovimientoCaja {
  return {
    id: row.id,
    fecha: fmtDayMonth(row.fecha),
    hora: fmtTime(row.fecha),
    concepto: row.concepto,
    medioPago: row.medio_pago,
    tipo: row.tipo,
    cajaId: row.caja_id,
    monto: row.monto,
    usuario: row.usuario_nombre,
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
  monto: number;
}): Promise<MovimientoCaja> {
  const user = await requireUser();
  const supabase = createServerClient();
  const { data: row, error } = await supabase
    .from("movimientos_caja")
    .insert({
      caja_id: data.cajaId,
      concepto: data.concepto,
      medio_pago: data.medioPago,
      tipo: data.tipo,
      monto: data.monto,
      usuario_id: user.id,
      usuario_nombre: user.nombre,
    })
    .select(MOV_COLS)
    .single();
  if (error) throw error;
  return toMovimiento(row as unknown as MovimientoRow);
}

// ─────────────────────────── Conciliaciones ───────────────────────────

type ConciliacionRow = {
  id: string;
  fecha: string;
  responsable_nombre: string;
  lineas: ConciliacionLinea[];
};

const CONC_COLS = "id, fecha, responsable_nombre, lineas";

function toConciliacion(row: ConciliacionRow): Conciliacion {
  return {
    id: row.id,
    fecha: fmtDayMonth(row.fecha),
    hora: fmtTime(row.fecha),
    responsable: row.responsable_nombre,
    lineas: row.lineas,
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
export async function crearConciliacion(lineas: ConciliacionLinea[]): Promise<Conciliacion> {
  const user = await requireUser();
  const supabase = createServerClient();
  const { data: row, error } = await supabase
    .from("conciliaciones")
    .insert({
      responsable_id: user.id,
      responsable_nombre: user.nombre,
      lineas,
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
