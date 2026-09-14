import "server-only";
import { createServerClient } from "@/lib/auth/supabase";
import { requireUser } from "@/lib/auth";
import { fmtDayMonth, fmtTime } from "@/lib/format";
import type { MovimientoCC } from "@/lib/types";

type MovimientoCCRow = {
  id: string;
  cliente_id: string;
  fecha: string;
  concepto: string;
  tipo: "cargo" | "pago";
  monto_usd: number;
  usuario_nombre: string;
};

const COLS = "id, cliente_id, fecha, concepto, tipo, monto_usd, usuario_nombre";

function toMovimiento(row: MovimientoCCRow): MovimientoCC {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    fecha: fmtDayMonth(row.fecha),
    hora: fmtTime(row.fecha),
    concepto: row.concepto,
    tipo: row.tipo,
    montoUsd: row.monto_usd,
    usuario: row.usuario_nombre,
  };
}

export async function listMovimientosCC(): Promise<MovimientoCC[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("movimientos_cc")
    .select(COLS)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return (data as unknown as MovimientoCCRow[]).map(toMovimiento);
}

export async function createMovimientoCC(data: {
  clienteId: string;
  tipo: "cargo" | "pago";
  concepto: string;
  montoUsd: number;
}): Promise<MovimientoCC> {
  const user = await requireUser();
  const supabase = createServerClient();
  const { data: row, error } = await supabase
    .from("movimientos_cc")
    .insert({
      cliente_id: data.clienteId,
      concepto: data.concepto,
      tipo: data.tipo,
      monto_usd: data.montoUsd,
      usuario_id: user.id,
      usuario_nombre: user.nombre,
    })
    .select(COLS)
    .single();
  if (error) throw error;
  return toMovimiento(row as unknown as MovimientoCCRow);
}
