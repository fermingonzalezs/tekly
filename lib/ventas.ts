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
export function saldarUltimoPago<T extends PagoDraft & { medio?: string }>(
  pagos: T[],
  restante: number,
): T[] {
  // El pago en canje no se ajusta: su monto es el precio de compra del
  // equipo recibido (se edita en su modal). Se salda el último de los otros.
  let idx = -1;
  for (let i = pagos.length - 1; i >= 0; i--) {
    if (pagos[i].medio !== "canje") {
      idx = i;
      break;
    }
  }
  if (idx === -1) return pagos;
  const monto = Math.max(0, Math.round((pagos[idx].montoUsd + restante) * 100) / 100);
  return pagos.map((p, i) => (i === idx ? { ...p, montoUsd: monto } : p));
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
export function margenVenta<T extends Pick<VentaItem, "cantidad" | "precioUsd" | "costoUsd">>(items: T[]): {
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

/** Costo unitario efectivo de un ítem de venta: su costo propio más los
 * repuestos usados (al costo del repuesto, repartido por la cantidad del
 * ítem). `undefined` = sin dato: ni costo propio ni repuestos con costo
 * conocido -- así un servicio o un ítem libre sin costo cargado no cuenta
 * como 100 % de margen. */
export function costoUnitarioItem(
  item: Pick<VentaItem, "costoUsd" | "cantidad" | "repuestos">,
  costoRepuesto: (repuestoId: string) => number | undefined,
): number | undefined {
  let repuestos = 0;
  let conRepuestos = false;
  for (const r of item.repuestos ?? []) {
    const c = costoRepuesto(r.repuestoId);
    if (c === undefined) continue;
    conRepuestos = true;
    repuestos += c * r.cantidad;
  }
  if (!conRepuestos) return item.costoUsd;
  const unitario = (item.costoUsd ?? 0) + repuestos / Math.max(1, item.cantidad);
  return Math.round(unitario * 100) / 100;
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
  /** Σ ganancia (precio − costo) de los ítems con costo; `null` sin costos.
   * Mismo criterio que `margenVenta`. */
  gananciaUsd: number | null;
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
    gananciaUsd: gananciaTotal(ventas),
  };
}

/** Ganancia sumada de un conjunto de ventas (solo ítems con costo).
 * `null` si ninguna venta tiene costos cargados. */
export function gananciaTotal(ventas: Pick<VentaParaResumen, "items">[]): number | null {
  let total = 0;
  let conCosto = false;
  for (const v of ventas) {
    const m = margenVenta(v.items);
    if (m.margenPct === null) continue;
    conCosto = true;
    total += m.gananciaUsd;
  }
  return conCosto ? total : null;
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
  items: { detalle?: string; precioUsd: number; regalo?: boolean }[];
  pagos: { montoUsd: number; medio: MedioPagoVenta; canjeEquipo?: string }[];
  /** Ajuste firmado sobre el total: >0 descuenta, <0 recarga. Con
   * `subtotalUsd` se valida antes de conciliar los pagos. */
  ajusteUsd?: number;
  subtotalUsd?: number;
  /** La venta entera es un regalo: total 0, sin pagos. */
  regalo?: boolean;
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
  if (i.regalo) {
    // El regalo es de la venta entera: no se cobra nada.
    if (i.pagos.some((p) => p.montoUsd > 0)) return "Un regalo no lleva pagos";
    return null;
  }
  // Los regalos van en 0 a propósito; el resto necesita precio. Si todo es
  // regalo, la venta es «Regalo»: no se cobra nada.
  if (i.items.every((it) => it.regalo)) {
    if (i.pagos.some((p) => p.montoUsd > 0)) return "Un regalo no lleva pagos";
    return null;
  }
  if (i.items.some((it) => !it.regalo && it.precioUsd <= 0)) return "Hay un ítem sin precio";
  if (i.subtotalUsd !== undefined && i.ajusteUsd !== undefined) {
    const err = errorAjuste(i.subtotalUsd, i.ajusteUsd);
    if (err) return err;
  }

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

// ── Descuento de la venta y regalos (plan 026) ──────────────────────────────

export type ItemParaDescuento = { cantidad: number; precioUsd: number; regalo?: boolean };

export type ResultadoDescuento = {
  /** Mismo orden que la entrada: precio unitario efectivo y, si cambió, el de lista. */
  items: { precioUsd: number; precioListaUsd?: number }[];
  subtotalUsd: number;
  descuentoUsd: number;
  totalUsd: number;
};

const aCentavos = (n: number) => Math.round(n * 100);

/** Descuento en USD a partir de un %, redondeado a centavos. */
export function descuentoDesdePct(subtotalUsd: number, pct: number): number {
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  return aCentavos((subtotalUsd * pct) / 100) / 100;
}

/** `null` si el descuento es válido para ese subtotal (sin regalos). */
export function errorDescuento(subtotalUsd: number, descuentoUsd: number): string | null {
  if (!Number.isFinite(descuentoUsd) || descuentoUsd < 0) return "El descuento no puede ser negativo";
  if (descuentoUsd > 0 && aCentavos(descuentoUsd) >= aCentavos(subtotalUsd)) {
    return "El descuento tiene que ser menor que el subtotal";
  }
  return null;
}

/**
 * Prorratea `descuentoUsd` entre los ítems que no son regalo, proporcional a
 * su subtotal (cantidad × precio de lista), en centavos exactos. El resto de
 * redondeo va a un ítem donde cierre exacto (preferentemente `cantidad = 1`,
 * el de mayor subtotal). Regalos → precio 0, sin descuento.
 */
export function aplicarDescuentoVenta(
  items: ItemParaDescuento[],
  descuentoUsd: number,
): ResultadoDescuento {
  const precios = items.map((i) => (i.regalo ? 0 : Math.max(0, aCentavos(i.precioUsd))));
  const cant = items.map((i) => Math.max(1, Math.round(i.cantidad)));
  const subs = precios.map((p, k) => p * cant[k]);
  const subtotal = subs.reduce((a, s) => a + s, 0);
  const desc = Math.min(Math.max(0, aCentavos(descuentoUsd)), subtotal);

  // Descuento por unidad de cada línea (en centavos, hacia abajo).
  const porUnidad = subs.map((s, k) =>
    subtotal > 0 ? Math.floor((desc * s) / subtotal / cant[k]) : 0,
  );
  let resto = desc - porUnidad.reduce((a, u, k) => a + u * cant[k], 0);

  // Repartir el resto: primero en unidades enteras de cada línea (más caras primero),
  // y lo que no divida exacto va a una línea de cantidad 1.
  const orden = subs
    .map((s, k) => k)
    .filter((k) => subs[k] > 0)
    .sort((a, b) => subs[b] - subs[a]);
  for (const k of orden) {
    if (resto <= 0) break;
    const extra = Math.floor(resto / cant[k]);
    const max = precios[k] - porUnidad[k];
    const usar = Math.min(extra, max);
    porUnidad[k] += usar;
    resto -= usar * cant[k];
  }
  if (resto > 0) {
    const k = orden.find((j) => cant[j] === 1 && precios[j] - porUnidad[j] >= resto);
    if (k !== undefined) {
      porUnidad[k] += resto;
      resto = 0;
    }
  }
  const aplicado = desc - resto; // si no cerró (caso extremo), se aplica lo que se pudo

  return {
    items: items.map((it, k) => {
      const efectivo = (precios[k] - porUnidad[k]) / 100;
      const lista = it.regalo ? 0 : precios[k] / 100;
      return porUnidad[k] > 0 ? { precioUsd: efectivo, precioListaUsd: lista } : { precioUsd: efectivo };
    }),
    subtotalUsd: subtotal / 100,
    descuentoUsd: aplicado / 100,
    totalUsd: (subtotal - aplicado) / 100,
  };
}

export type ResultadoAjuste = {
  /** Mismo orden que la entrada: precio efectivo + precio de lista si cambió. */
  items: { precioUsd: number; precioListaUsd?: number }[];
  subtotalUsd: number;
  /** Firmado: >0 descuento, <0 recargo. Ya prorrateado en los ítems. */
  ajusteUsd: number;
  totalUsd: number;
};

/** Diferencia en USD a partir de un % firmado (positivo descuenta, negativo
 * recarga), redondeado a centavos. */
export function ajusteDesdePct(subtotalUsd: number, pct: number): number {
  if (!Number.isFinite(pct) || pct === 0) return 0;
  const monto = aCentavos((subtotalUsd * Math.abs(pct)) / 100) / 100;
  return pct > 0 ? monto : -monto;
}

/** `null` si la diferencia es válida. Un descuento no puede dejar el total en
 * 0 o menos; un recargo (negativo) no tiene tope. */
export function errorAjuste(subtotalUsd: number, ajusteUsd: number): string | null {
  if (!Number.isFinite(ajusteUsd)) return "El descuento no es un monto válido";
  if (ajusteUsd < 0) return "El descuento no puede ser negativo";
  if (ajusteUsd > 0 && aCentavos(ajusteUsd) >= aCentavos(subtotalUsd)) {
    return "El descuento no puede cubrir todo el subtotal";
  }
  return null;
}

/** Ajuste firmado sobre el total (plan 026 revisado): >0 descuenta (mismo
 * prorrateo que `aplicarDescuentoVenta`), <0 recarga proporcional. En ambos
 * casos Σ precio × cantidad = total. */
export function aplicarAjusteVenta(
  items: ItemParaDescuento[],
  ajusteUsd: number,
): ResultadoAjuste {
  const monto = Number.isFinite(ajusteUsd) ? ajusteUsd : 0;
  if (monto >= 0) {
    const r = aplicarDescuentoVenta(items, monto);
    return {
      items: r.items,
      subtotalUsd: r.subtotalUsd,
      ajusteUsd: r.descuentoUsd,
      totalUsd: r.totalUsd,
    };
  }

  // Recargo: espejo del descuento, sumando centavos proporcionalmente.
  const precios = items.map((i) => (i.regalo ? 0 : Math.max(0, aCentavos(i.precioUsd))));
  const cant = items.map((i) => Math.max(1, Math.round(i.cantidad)));
  const subs = precios.map((p, k) => p * cant[k]);
  const subtotal = subs.reduce((a, s) => a + s, 0);
  const totalRecargo = aCentavos(-monto);

  const porUnidad = subs.map(() => 0);
  let resto = totalRecargo;
  if (subtotal > 0) {
    for (let k = 0; k < subs.length; k += 1) {
      porUnidad[k] = Math.floor((totalRecargo * subs[k]) / subtotal / cant[k]);
    }
    resto = totalRecargo - porUnidad.reduce((a, u, k) => a + u * cant[k], 0);
    const orden = subs
      .map((s, k) => k)
      .filter((k) => subs[k] > 0)
      .sort((a, b) => subs[b] - subs[a]);
    for (const k of orden) {
      if (resto <= 0) break;
      const extra = Math.floor(resto / cant[k]);
      if (extra > 0) {
        porUnidad[k] += extra;
        resto -= extra * cant[k];
      }
    }
  } else {
    // Sin subtotal (ítems en 0): todo el recargo va al primer ítem que no
    // sea regalo.
    const k = items.findIndex((i) => !i.regalo);
    if (k >= 0) {
      porUnidad[k] = Math.floor(totalRecargo / cant[k]);
      resto = totalRecargo - porUnidad[k] * cant[k];
    }
  }
  if (resto > 0) {
    const k = items.findIndex((it, idx) => !it.regalo && cant[idx] === 1);
    if (k >= 0) {
      porUnidad[k] += resto;
      resto = 0;
    }
  }
  const aplicado = totalRecargo - resto;

  return {
    items: items.map((it, k) => {
      const efectivo = (precios[k] + porUnidad[k]) / 100;
      const lista = it.regalo ? 0 : precios[k] / 100;
      return porUnidad[k] > 0
        ? { precioUsd: efectivo, precioListaUsd: lista }
        : { precioUsd: efectivo };
    }),
    subtotalUsd: subtotal / 100,
    ajusteUsd: -aplicado / 100,
    totalUsd: (subtotal + aplicado) / 100,
  };
}

/**
 * Precios finales de una venta nueva (plan 026, regalos por ítem): los ítems
 * de regalo quedan en 0 (conservan su costo) y el descuento se prorratea en
 * el resto. La usan `createVenta`, la demo y Nueva venta: misma cuenta en
 * los tres lados. `ajusteUsd` es el descuento ≥ 0.
 */
export function preciosDeVenta<T extends Pick<VentaItem, "cantidad" | "precioUsd" | "regalo">>(
  items: T[],
  ajusteUsd: number,
): { items: (T & { precioListaUsd?: number })[]; totalUsd: number; ajusteUsd: number } {
  const base = items.map((i) => ({ ...i, regalo: i.regalo || undefined, precioUsd: i.regalo ? 0 : i.precioUsd }));
  const r = aplicarAjusteVenta(
    base.map((i) => ({ cantidad: i.cantidad, precioUsd: i.precioUsd, regalo: !!i.regalo })),
    ajusteUsd,
  );
  return {
    items: base.map((it, k) => ({
      ...it,
      precioUsd: r.items[k].precioUsd,
      precioListaUsd: r.items[k].precioListaUsd,
    })),
    totalUsd: r.totalUsd,
    ajusteUsd: r.ajusteUsd,
  };
}

/** Reglas de los ítems de una venta nueva que el server no delega a la UI:
 * solo se vende stock (celular, notebook, producto de «Otros») o servicios
 * del catálogo -- no hay ítems libres --, y los regalos son repuestos o
 * productos de «Otros».
 * Una venta toda de regalo es válida (total 0, sin pagos: «Regalo»). */
export function errorItemsVenta(
  items: Pick<VentaItem, "regalo" | "celularId" | "notebookId" | "otroId" | "categoria" | "repuestos">[],
  ajusteUsd: number,
): string | null {
  if (items.length === 0) return "La venta necesita al menos un ítem.";
  for (const i of items) {
    // Regalo de un repuesto: ítem «otro» con el repuesto vinculado (descuenta
    // su stock por `venta_item_repuestos`).
    const repuestoRegalado = !!i.regalo && i.categoria === "otro" && (i.repuestos?.length ?? 0) > 0;
    const delStock =
      (i.categoria === "celular" && !!i.celularId) ||
      (i.categoria === "notebook" && !!i.notebookId) ||
      (i.categoria === "otro" && !!i.otroId) ||
      repuestoRegalado ||
      i.categoria === "servicio";
    if (!delStock) return "Solo se pueden vender ítems del stock o servicios del catálogo.";
    if (i.regalo && i.categoria !== "otro") {
      return "Los regalos son repuestos o productos de «Otros».";
    }
  }
  if (!Number.isFinite(ajusteUsd) || ajusteUsd < 0) return "El descuento no puede ser negativo.";
  return null;
}

/** Una venta es «Regalo» (total 0, sin pagos) cuando todos sus ítems lo son. */
export function esVentaRegalo(items: Pick<VentaItem, "regalo">[]): boolean {
  return items.length > 0 && items.every((i) => i.regalo);
}
