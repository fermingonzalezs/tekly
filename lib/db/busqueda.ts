import "server-only";
import { createServerClient } from "@/lib/auth/supabase";
import { fmtArs, fmtDayMonth, fmtUsd } from "@/lib/format";
import { equipoStatus } from "@/lib/status";
import type { EquipoStatus } from "@/lib/types";

/** Búsqueda global de la CommandPalette (Cmd+K) -- un server action la llama
 * con cada query debounced. Corre con el cliente normal (respeta RLS): cada
 * organización busca solo en sus propios datos gratis, sin filtrar
 * `organization_id` a mano ni service role de por medio.
 *
 * Best-effort por fuente: si una de las cinco queries falla, esa sección
 * simplemente no aparece en los resultados en vez de romper toda la búsqueda
 * -- una búsqueda en vivo degrada mejor en silencio que tirando la palette. */

export type ResultadoBusquedaTipo =
  | "cliente"
  | "venta"
  | "ticket"
  | "equipo"
  | "movimiento_caja";

export type ResultadoBusqueda = {
  tipo: ResultadoBusquedaTipo;
  id: string;
  titulo: string;
  subtitulo: string;
  href: string;
};

/** Mínimo 2 caracteres (si no no vale la pena la ida y vuelta), máximo 5
 * resultados por tabla -- la palette agrupa por tipo y no necesita más. */

// `clientes(nombre)`/`cajas(...)` lo tipa como array el parser de select de
// supabase-js -- mismo cast a fila-plana que hace `lib/db/reparaciones.ts`.
type TicketRow = {
  id: number;
  clientes: { nombre: string } | null;
  equipo: string;
  imei: string | null;
  falla: string;
};

type MovimientoRow = {
  id: string;
  concepto: string;
  tipo: "ingreso" | "egreso";
  monto: number;
  cajas: { nombre: string; moneda: "usd" | "ars" } | null;
};

type EquipoRow = {
  id: string;
  modelo: string;
  almacenamiento: string | null;
  imei: string | null;
  estado: EquipoStatus;
};

export async function buscarGlobal(query: string): Promise<ResultadoBusqueda[]> {
  const q = query.trim().replace(/"/g, "");
  if (q.length < 2) return [];
  // Los patrones van COMILLEADOS dentro de or() para que una coma o paréntesis
  // en la query del usuario no rompan la gramática de PostgREST (verificado
  // contra el proyecto -- sin comillas una "a,b" parte el filtro en dos).
  const patron = `%${q}%`;
  const hrefQ = encodeURIComponent(query.trim());
  const supabase = createServerClient();

  const [cliRes, venRes, ticRes, equRes, movRes] = await Promise.all([
    supabase
      .from("clientes")
      .select("id, nombre, telefono, email")
      .or(`nombre.ilike."${patron}",telefono.ilike."${patron}"`)
      .order("nombre")
      .limit(5),
    supabase
      .from("ventas")
      .select("id, numero, cliente, fecha, total_usd")
      .or(
        /^\d+$/.test(q)
          ? `cliente.ilike."${patron}",numero.eq.${Number(q)}`
          : `cliente.ilike."${patron}"`,
      )
      .order("numero", { ascending: false })
      .limit(5),
    supabase
      .from("tickets")
      .select("id, clientes(nombre), equipo, imei, falla")
      .or(`equipo.ilike."${patron}",imei.ilike."${patron}",falla.ilike."${patron}"`)
      .order("id", { ascending: false })
      .limit(5),
    supabase
      .from("equipos")
      .select("id, modelo, almacenamiento, imei, estado")
      .or(`modelo.ilike."${patron}",imei.ilike."${patron}"`)
      .order("modelo")
      .limit(5),
    supabase
      .from("movimientos_caja")
      .select("id, concepto, tipo, monto, cajas(nombre, moneda)")
      .ilike("concepto", patron)
      .order("fecha", { ascending: false })
      .limit(5),
  ]);

  const clientes = (cliRes.data ?? []).map((c) => ({
    tipo: "cliente" as const,
    id: c.id,
    titulo: c.nombre,
    subtitulo:
      [c.telefono, c.email].filter(Boolean).join(" · ") || "Cliente",
    href: `/clientes?open=${c.id}`,
  }));

  const ventas = (venRes.data ?? []).map((v) => ({
    tipo: "venta" as const,
    id: v.id,
    titulo: v.cliente || "—",
    subtitulo: `V-${v.numero} · ${fmtDayMonth(v.fecha)} · ${fmtUsd(v.total_usd)}`,
    href: `/ventas?q=${hrefQ}`,
  }));

  const tickets = ((ticRes.data ?? []) as unknown as TicketRow[]).map((t) => ({
    tipo: "ticket" as const,
    id: String(t.id),
    titulo: t.clientes?.nombre ?? "Cliente",
    subtitulo: `#${t.id} · ${t.equipo} · ${t.falla}`,
    href: `/reparaciones?q=${hrefQ}`,
  }));

  const equipos = ((equRes.data ?? []) as unknown as EquipoRow[]).map((e) => ({
    tipo: "equipo" as const,
    id: e.id,
    titulo: e.almacenamiento ? `${e.modelo} · ${e.almacenamiento}` : e.modelo,
    subtitulo: `${e.imei || "sin IMEI"} · ${equipoStatus[e.estado].label}`,
    href: `/inventario?tab=equipos&q=${hrefQ}`,
  }));

  const movimientos = ((movRes.data ?? []) as unknown as MovimientoRow[]).map(
    (m) => ({
      tipo: "movimiento_caja" as const,
      id: m.id,
      titulo: m.concepto,
      subtitulo: `${m.cajas?.nombre ?? "—"} · ${
        m.tipo === "ingreso" ? "+" : "−"
      }${m.cajas?.moneda === "ars" ? fmtArs(m.monto) : fmtUsd(m.monto)}`,
      href: `/cajas?q=${hrefQ}`,
    }),
  );

  return [...clientes, ...ventas, ...tickets, ...equipos, ...movimientos];
}
