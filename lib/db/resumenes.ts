import "server-only";
import { createServerClient, createServiceRoleClient } from "@/lib/auth/supabase";
import { conOrganizacion } from "@/lib/auth/scope";
import { listCajas, listMovimientos } from "@/lib/db/cajas";
import { listMovimientosCC } from "@/lib/db/cuentas-corrientes";
import { listClientes } from "@/lib/db/clientes";
import { getNegocio } from "@/lib/db/configuracion";
import { listCelulares, listOtros, listRepuestos, listMovimientosStockBulk } from "@/lib/db/inventario";
import { listNotebooks } from "@/lib/db/notebooks";
import { listCompras } from "@/lib/db/compras";
import { listTickets } from "@/lib/db/reparaciones";
import { listTurnosRango } from "@/lib/db/turnos";
import { listVentas } from "@/lib/db/ventas";
import { getDolarServer } from "@/lib/dolar-server";
import {
  RESUMEN_VERSION,
  armarResumenMensual,
  esPeriodo,
  periodoACerrar,
  rangoDeMes,
  type ResumenMensual,
} from "@/lib/resumen-mensual";

/** Resumen mensual (plan 022). `armarDatos` usa las mismas `list*` que el resto
 *  de la app: con sesión (admin, botón «Generar») corren bajo RLS; en el cron
 *  corren dentro de `conOrganizacion` (service role acotado a la org, solo
 *  lectura, ver `lib/auth/scope.ts`). La escritura va siempre por service role
 *  con el `organization_id` explícito: la tabla no tiene policies de escritura
 *  para `authenticated`.
 *
 *  Escala: igual que Patrimonio, trae las listas completas y filtra el mes en
 *  JS; una vez por mes y por organización es aceptable. */

export type OrigenResumen = "cron" | "manual";


/** Arma el resumen sin guardarlo (lo usan el cron, el botón manual y las
 *  pruebas de humo). */
export async function armarDatos(periodo: string, hoy: Date): Promise<ResumenMensual> {
  const rango = rangoDeMes(periodo);
  const [
    dolar, negocio, ventas, tickets, movimientos, movimientosCC, cajas, compras,
    celulares, notebooks, repuestos, otros, movimientosStock, clientes, turnos,
  ] = await Promise.all([
    getDolarServer(),
    getNegocio(),
    listVentas(),
    listTickets(),
    listMovimientos(),
    listMovimientosCC(),
    listCajas(),
    listCompras(),
    listCelulares(),
    listNotebooks(),
    listRepuestos(),
    listOtros(),
    listMovimientosStockBulk(),
    listClientes(),
    listTurnosRango(rango.desde, rango.hasta),
  ]);
  return armarResumenMensual({
    periodo,
    hoy,
    // El valor de respaldo de `getDolarServer` es inventado: no se congela
    // en un resumen guardado.
    cotizacion: dolar.fuente === "api" ? dolar.venta : null,
    objetivoMesUsd: negocio.objetivoMesUsd,
    ventas, tickets, movimientos, movimientosCC, cajas, compras,
    celulares, notebooks, repuestos, otros, movimientosStock, clientes, turnos,
  });
}

/** Guarda con upsert. **Nunca pisa un resumen congelado** (`foto_fiable`) con
 *  uno que no lo es (ej. regenerar a mano un mes viejo: perdería la foto real
 *  del cierre). Devuelve `false` si lo omitió por eso. */
async function guardar(
  organizationId: string,
  r: ResumenMensual,
  origen: OrigenResumen,
): Promise<boolean> {
  const supabase = createServiceRoleClient();
  if (!r.foto.fiable) {
    const { data: previo, error: errorPrevio } = await supabase
      .from("resumenes_mensuales")
      .select("foto_fiable")
      .eq("organization_id", organizationId)
      .eq("periodo", `${r.periodo}-01`)
      .maybeSingle();
    if (errorPrevio) throw errorPrevio;
    if (previo?.foto_fiable) return false;
  }
  const { error } = await supabase.from("resumenes_mensuales").upsert(
    {
      organization_id: organizationId,
      periodo: `${r.periodo}-01`,
      facturado_usd: r.ventas.facturacionUsd,
      ventas_cantidad: r.ventas.operaciones,
      ganancia_usd: r.ventas.gananciaUsd,
      cobrado_reparaciones_usd: r.reparaciones.cobradoUsd,
      compras_usd: r.compras.totalUsd,
      patrimonio_usd: r.patrimonio?.netoUsd ?? null,
      datos: r,
      version: RESUMEN_VERSION,
      origen,
      foto_fiable: r.foto.fiable,
      generado_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,periodo" },
  );
  if (error) throw error;
  return true;
}

/** Cron: genera y guarda el resumen de `periodo` (default: el mes que acaba
 *  de cerrar) para **todas** las organizaciones. Una org que falla no frena a
 *  las demás; el resultado lista cada caso. */
export async function generarResumenesDeTodasLasOrganizaciones(
  periodo: string = periodoACerrar(new Date()),
): Promise<{
  periodo: string;
  ok: number;
  omitidos: number;
  errores: { organizationId: string; error: string }[];
}> {
  if (!esPeriodo(periodo)) throw new Error(`Período inválido: ${periodo}`);
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("organizations").select("id");
  if (error) throw error;

  let ok = 0;
  let omitidos = 0;
  const errores: { organizationId: string; error: string }[] = [];
  for (const { id } of data as { id: string }[]) {
    try {
      const r = await conOrganizacion(id, () => armarDatos(periodo, new Date()));
      if (await guardar(id, r, "cron")) ok += 1;
      else omitidos += 1;
    } catch (e) {
      errores.push({ organizationId: id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { periodo, ok, omitidos, errores };
}

/** Botón «Generar resumen» del admin: la org es la de su sesión. */
export async function generarResumenPropio(
  organizationId: string,
  periodo: string,
): Promise<void> {
  if (!esPeriodo(periodo)) throw new Error(`Período inválido: ${periodo}`);
  const r = await armarDatos(periodo, new Date());
  if (!(await guardar(organizationId, r, "manual"))) {
    throw new Error("Ese mes ya está cerrado y congelado: no se puede regenerar.");
  }
}

// ───────────────────────────── Lectura (admin, RLS) ─────────────────────────────

export type ResumenGuardado = {
  periodo: string; // "2026-09"
  facturadoUsd: number;
  ventasCantidad: number;
  gananciaUsd: number | null;
  cobradoReparacionesUsd: number;
  comprasUsd: number;
  patrimonioUsd: number | null;
  origen: OrigenResumen;
  fotoFiable: boolean;
  generadoAt: string;
};

type Row = {
  periodo: string;
  facturado_usd: number | string;
  ventas_cantidad: number;
  ganancia_usd: number | string | null;
  cobrado_reparaciones_usd: number | string;
  compras_usd: number | string;
  patrimonio_usd: number | string | null;
  origen: OrigenResumen;
  foto_fiable: boolean;
  generado_at: string;
};

const num = (v: number | string | null) => (v === null ? null : Number(v));

export async function listResumenes(): Promise<ResumenGuardado[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("resumenes_mensuales")
    .select(
      "periodo, facturado_usd, ventas_cantidad, ganancia_usd, cobrado_reparaciones_usd, compras_usd, patrimonio_usd, origen, foto_fiable, generado_at",
    )
    .order("periodo", { ascending: false });
  if (error) throw error;
  return (data as unknown as Row[]).map((r) => ({
    periodo: r.periodo.slice(0, 7),
    facturadoUsd: Number(r.facturado_usd),
    ventasCantidad: r.ventas_cantidad,
    gananciaUsd: num(r.ganancia_usd),
    cobradoReparacionesUsd: Number(r.cobrado_reparaciones_usd),
    comprasUsd: Number(r.compras_usd),
    patrimonioUsd: num(r.patrimonio_usd),
    origen: r.origen,
    fotoFiable: r.foto_fiable,
    generadoAt: r.generado_at,
  }));
}

export async function getResumen(
  periodo: string,
): Promise<{ resumen: ResumenMensual; origen: OrigenResumen; generadoAt: string } | null> {
  if (!esPeriodo(periodo)) return null;
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("resumenes_mensuales")
    .select("datos, origen, generado_at")
    .eq("periodo", `${periodo}-01`)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as { datos: ResumenMensual; origen: OrigenResumen; generado_at: string };
  return { resumen: row.datos, origen: row.origen, generadoAt: row.generado_at };
}
