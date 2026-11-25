/** Lógica pura del form de "Nueva venta" -- sin Supabase, testeable sin
 * red. Extraída de `app/ventas/page.tsx` (antes vivía inline en el
 * componente del modal). */

import type { CelularStatus, MedioPagoVenta, ModalidadVenta, Pago, Venta, VentaItem } from "@/lib/types";
import { fmtArs, fmtUsd } from "@/lib/format";
import { hoyISO } from "@/lib/date-presets";

export type PagoDraft = { montoUsd: number };

export type Rubro = NonNullable<VentaItem["categoria"]>;

export const RUBRO_LABEL: Record<Rubro, string> = {
  celular: "Celulares",
  notebook: "Notebooks",
  servicio: "Reparaciones",
  otro: "Accesorios",
  libre: "Otros",
};

export const RUBRO_ORDEN = Object.keys(RUBRO_LABEL) as Rubro[];

/** Ventas de antes de trackear `VentaItem.categoria` sólo permiten inferir
 * con certeza el caso "celular" (tiene `celularId`); el resto cae en "Otros"
 * en vez de adivinar servicio/producto/libre. Compartida entre
 * `ventasPorRubro` (dashboard) y `margenPorTipo` (analíticas) -- una sola
 * fuente de verdad para el rubro de un ítem. */
/** `false` para un pago en canje («Mercadería») o a cuenta corriente: son
 * los dos medios que **no** son una caja ni generan `movimientos_caja`
 * (plan 020). La caja real la elige el usuario, va en `cajaId`. */
export function pagoGeneraMovimientoCaja(p: Pick<Pago, "medio">): boolean {
  return p.medio !== "cuenta_corriente" && p.medio !== "canje";
}

/** El celular que entró por un canje solo se puede dar de baja al eliminar
 * la venta si sigue `en_revision` o `disponible`: si ya se vendió, reservó
 * o extravió, se conserva (plan 020). */
export function celularCanjeBorrable(estado: CelularStatus): boolean {
  return estado === "en_revision" || estado === "disponible";
}

export function categoriaDe(item: VentaItem): Rubro {
  return item.categoria ?? (item.celularId ? "celular" : "libre");
}

/** % de margen sobre precio -- 0 si no hay precio (evita división por 0). */
export function calcularMargenPct(totalPrecio: number, totalCosto: number): number {
  if (totalPrecio <= 0) return 0;
  return ((totalPrecio - totalCosto) / totalPrecio) * 100;
}

/** Lo que falta (positivo) o sobra (negativo) para cubrir el total con los
 * pagos cargados hasta ahora. Redondeado a centavos. */
export function calcularRestante(totalPrecio: number, pagos: PagoDraft[]): number {
  const pagado = pagos.reduce((a, p) => a + p.montoUsd, 0);
  return Math.round((totalPrecio - pagado) * 100) / 100;
}

/** Ajusta el último pago para que la suma cierre exacto con el total
 * (botón "Saldar"). No deja el monto negativo. */
export function saldarUltimoPago<T extends PagoDraft>(pagos: T[], restante: number): T[] {
  if (pagos.length === 0) return pagos;
  const last = pagos[pagos.length - 1];
  const monto = Math.max(0, Math.round((last.montoUsd + restante) * 100) / 100);
  return pagos.map((p, i) => (i === pagos.length - 1 ? { ...p, montoUsd: monto } : p));
}

/** Monto real cobrado/movido por un pago con recargo -- `montoUsd` sigue
 * siendo la parte del total de la venta que ese pago cubre (no cambia
 * `calcularRestante`/`saldarUltimoPago`); esto es solo lo que el medio con
 * recargo hace pagar de más por arriba, para el movimiento de caja/cuenta
 * corriente que genera y para el aviso en "Nueva venta". */
export function montoConRecargo(montoUsd: number, recargoPct: number | undefined): number {
  if (!recargoPct) return montoUsd;
  return Math.round(montoUsd * (1 + recargoPct / 100) * 100) / 100;
}

/** Texto del monto de un pago ya guardado. ARS: usa el snapshot
 * (`montoArs`, que ya incluye el recargo); si una venta vieja no lo tiene,
 * cae a USD -- nunca recalcula con la cotización de hoy. */
export function montoPagoLabel(p: Pago): string {
  return p.montoArs !== undefined ? fmtArs(p.montoArs) : fmtUsd(p.montoUsd);
}

/** Margen de una venta: solo sobre los ítems con `costoUsd` cargado
 * (mismo criterio que `margenPorTipo` en lib/analiticas.ts). `null` si
 * ningún ítem tiene costo -- "sin dato", no 100 %. */
export function margenVenta(items: VentaItem[]): {
  costoUsd: number;
  gananciaUsd: number;
  margenPct: number | null;
} {
  let precio = 0;
  let costo = 0;
  let conCosto = false;
  for (const i of items) {
    if (i.costoUsd === undefined) continue;
    conCosto = true;
    precio += i.precioUsd * i.cantidad;
    costo += i.costoUsd * i.cantidad;
  }
  if (!conCosto) return { costoUsd: 0, gananciaUsd: 0, margenPct: null };
  return {
    costoUsd: costo,
    gananciaUsd: precio - costo,
    margenPct: precio > 0 ? ((precio - costo) / precio) * 100 : 0,
  };
}

/** Margen agregado de un conjunto de ventas, ponderado por facturación:
 * Σ ganancia / Σ precio, solo ítems con costo. `null` si ninguna tiene
 * costos cargados. Acepta cualquier objeto con `items` -- lo usan tanto
 * `Venta[]` como el resumen liviano del server (plan 007). */
export function margenPonderado(
  ventas: { items: { cantidad: number; precioUsd: number; costoUsd?: number }[] }[],
): number | null {
  let precio = 0;
  let ganancia = 0;
  let conCosto = false;
  for (const v of ventas) {
    for (const i of v.items) {
      if (i.costoUsd === undefined) continue;
      conCosto = true;
      precio += i.precioUsd * i.cantidad;
      ganancia += (i.precioUsd - i.costoUsd) * i.cantidad;
    }
  }
  if (!conCosto) return null;
  return precio > 0 ? (ganancia / precio) * 100 : 0;
}

// ───────────────────── Minorista / mayorista ─────────────────────

export const MODALIDAD_LABEL: Record<ModalidadVenta, string> = {
  minorista: "Minorista",
  mayorista: "Mayorista",
};

/** Orden fijo de las modalidades (minorista primero: es el default). */
export const MODALIDADES: ModalidadVenta[] = ["minorista", "mayorista"];

export type ResumenModalidad = {
  modalidad: ModalidadVenta;
  label: string;
  facturacion: number;
  operaciones: number;
  ticketPromedio: number;
  /** Ponderado por facturación (`margenPonderado`); null = sin costos cargados. */
  margenPct: number | null;
  /** % de la facturación total del conjunto (0 si no hay facturación). */
  pct: number;
};

/** Facturación, operaciones, ticket promedio y margen por modalidad. Siempre
 * devuelve las dos modalidades (en `MODALIDADES`), aunque una no tenga ventas. */
export function resumenPorModalidad(
  ventas: {
    modalidad: ModalidadVenta;
    totalUsd: number;
    items: { cantidad: number; precioUsd: number; costoUsd?: number }[];
  }[],
): ResumenModalidad[] {
  const total = ventas.reduce((a, v) => a + v.totalUsd, 0);
  return MODALIDADES.map((modalidad) => {
    const deEsta = ventas.filter((v) => v.modalidad === modalidad);
    const facturacion = deEsta.reduce((a, v) => a + v.totalUsd, 0);
    const operaciones = deEsta.length;
    return {
      modalidad,
      label: MODALIDAD_LABEL[modalidad],
      facturacion,
      operaciones,
      ticketPromedio: operaciones > 0 ? facturacion / operaciones : 0,
      margenPct: margenPonderado(deEsta),
      pct: total > 0 ? (facturacion / total) * 100 : 0,
    };
  });
}

// ───────────────────────── Resumen (KPIs) ─────────────────────────

/** Input liviano del resumen -- lo que devuelve `resumenVentas` (plan 007)
 * sin traer la venta completa. */
export type VentaParaResumen = {
  totalUsd: number;
  items: { cantidad: number; precioUsd: number; costoUsd?: number }[];
};

export type ResumenVentas = {
  operaciones: number;
  facturado: number;
  ticketPromedio: number;
  itemsVendidos: number;
  /** `margenPonderado` sobre todo el período filtrado; `null` sin costos. */
  margenPct: number | null;
};

/** KPIs del período filtrado completo (no solo la página). Lógica pura para
 * poder testearla sin Supabase. */
export function resumenDeVentas(ventas: VentaParaResumen[]): ResumenVentas {
  const operaciones = ventas.length;
  const facturado = ventas.reduce((a, v) => a + v.totalUsd, 0);
  const itemsVendidos = ventas.reduce(
    (a, v) => a + v.items.reduce((b, i) => b + i.cantidad, 0),
    0,
  );
  return {
    operaciones,
    facturado,
    ticketPromedio: operaciones > 0 ? facturado / operaciones : 0,
    itemsVendidos,
    margenPct: margenPonderado(ventas),
  };
}

// ───────────────────── Gráficos de sección (plan 009) ─────────────────────

export type VentaParaGraficos = {
  /** Timestamp ISO de la venta (con hora). */
  fechaISO: string;
  totalUsd: number;
  /** Rubro + monto de cada ítem, ya resuelto por quien consulta. */
  rubros: { rubro: Rubro; monto: number }[];
};

export type BarraDato = { label: string; value: number };

export type GraficosVentas = {
  /** Facturación por día (hora argentina), orden cronológico. */
  porDia: BarraDato[];
  /** Mix por rubro del período, orden fijo `RUBRO_ORDEN`. */
  porRubro: BarraDato[];
};

/** Agrega la facturación por día y el mix por rubro del período filtrado.
 * Puro para testear sin Supabase; `lib/db/ventas.ts` le pasa las filas. */
export function graficosDeVentas(ventas: VentaParaGraficos[]): GraficosVentas {
  const porDia = new Map<string, number>();
  const porRubro = new Map<Rubro, number>();
  for (const v of ventas) {
    // `hoyISO` formatea en hora argentina (no `toISOString`, que es UTC).
    const dia = hoyISO(new Date(v.fechaISO));
    porDia.set(dia, (porDia.get(dia) ?? 0) + v.totalUsd);
    for (const r of v.rubros) {
      porRubro.set(r.rubro, (porRubro.get(r.rubro) ?? 0) + r.monto);
    }
  }
  const labelDia = (iso: string) => {
    const [, m, d] = iso.split("-");
    return `${d}/${m}`;
  };
  return {
    porDia: [...porDia.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([iso, value]) => ({ label: labelDia(iso), value })),
    porRubro: RUBRO_ORDEN.filter((r) => (porRubro.get(r) ?? 0) > 0).map((r) => ({
      label: RUBRO_LABEL[r],
      value: porRubro.get(r)!,
    })),
  };
}

// ─────────────────── Motivo bloqueante de "Nueva venta" ───────────────────
export type MotivoInput = {
  /** Vendedor elegido; vacío = falta escribirlo a mano. Omitido = no se valida. */
  vendedorNombre?: string;
  /** Nombre de una tienda nueva escrita a mano; omitido = no se valida. */
  tiendaNueva?: string;
  clienteNombre: string;
  items: { detalle?: string; precioUsd: number }[];
  pagos: { montoUsd: number; medio: MedioPagoVenta; canjeEquipo?: string }[];
  totalPrecio: number;
};

/** Primer motivo por el que "Nueva venta" no se puede confirmar, o `null` si
 * está lista. Orden pensado para guiar al vendedor paso a paso (plan 007);
 * el botón deshabilitado muestra este texto en el footer. */
export function motivoNoConfirmable(i: MotivoInput): string | null {
  if (!i.clienteNombre.trim()) return "Elegí un cliente";
  if (i.vendedorNombre !== undefined && !i.vendedorNombre.trim())
    return "Escribí el nombre del vendedor";
  if (i.tiendaNueva !== undefined && !i.tiendaNueva.trim())
    return "Escribí el nombre de la tienda nueva";
  if (i.items.length === 0) return "Agregá al menos un ítem";
  if (i.items.some((it) => !(it.detalle ?? "").trim()))
    return "Hay un ítem sin nombre";
  if (i.items.some((it) => it.precioUsd <= 0)) return "Hay un ítem sin precio";

  const restante = calcularRestante(i.totalPrecio, i.pagos);
  if (restante > 0.005) return `Faltan ${fmtUsd(restante)} por cobrar`;
  if (restante < -0.005) return `Sobran ${fmtUsd(Math.abs(restante))}`;
  if (i.pagos.some((p) => p.medio === "canje" && !(p.canjeEquipo ?? "").trim()))
    return "Falta cargar el equipo del canje";
  if (i.pagos.some((p) => p.montoUsd <= 0)) return "Completá el monto de cada pago";
  return null;
}

/** Largo máximo de un vendedor escrito a mano (mismo tope que el CHECK de
 * `ventas.vendedor_nombre`). */
export const VENDEDOR_LIBRE_MAX = 80;

/**
 * Vendedor de una venta nueva. Cualquier rol puede elegir a otro usuario
 * activo de la organización (`vendedorId`) o escribir un nombre a mano
 * (`vendedorId` vacío + `vendedorNombre`). El nombre de un usuario sale
 * siempre de `usuarios`, nunca del cliente.
 */
export function resolverVendedor(
  input: { vendedorId: string; vendedorNombre: string },
  usuarios: { id: string; nombre: string }[],
): { ok: true; vendedorId: string; vendedorNombre: string } | { ok: false; error: string } {
  if (input.vendedorId) {
    const u = usuarios.find((x) => x.id === input.vendedorId);
    if (!u) return { ok: false, error: "El vendedor elegido no es un usuario activo de la organización." };
    return { ok: true, vendedorId: u.id, vendedorNombre: u.nombre };
  }
  const nombre = input.vendedorNombre.trim().replace(/\s+/g, " ");
  if (!nombre) return { ok: false, error: "Escribí el nombre del vendedor." };
  if (nombre.length > VENDEDOR_LIBRE_MAX) {
    return { ok: false, error: `El nombre del vendedor no puede pasar de ${VENDEDOR_LIBRE_MAX} caracteres.` };
  }
  return { ok: true, vendedorId: "", vendedorNombre: nombre };
}
