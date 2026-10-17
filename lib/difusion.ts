import { fmtUsd } from "@/lib/format";
import { otroCostoPromedio } from "@/lib/otros";
import type {
  Celular,
  DifusionEntrada,
  ListaDifusion,
  Notebook,
  OtroItem,
} from "@/lib/types";

/** Lógica pura de Difusión (armado del mensaje de WhatsApp) y de los textos
 *  «para publicar» de un celular / notebook (botón de copiar de Inventario).
 *  Sin Supabase ni `window`: con test en `lib/difusion.test.ts`. */

export type Linea = { texto: string; precioUsd: number; costoUsd?: number };

/** Texto corto de una notebook para una línea de lista: modelo + lo que la
 *  define (memoria, almacenamiento), y «usada» cuando corresponde. */
export function textoLineaNotebook(n: Notebook): string {
  const base = [n.modelo, n.memoria, n.almacenamiento].filter(Boolean).join(" ");
  if (n.condicion !== "usado") return base;
  return `${base} (usada${n.bateria !== null ? `, batería ${n.bateria}%` : ""})`;
}

/** Convierte una regla/ítem manual en las líneas de mensaje que aporta —
 * las reglas de celular/notebook/otro se evalúan contra el stock actual
 * (solo lo `disponible`). */
export function expandirEntrada(
  entrada: DifusionEntrada,
  celulares: Celular[],
  otros: OtroItem[],
  notebooks: Notebook[] = [],
): Linea[] {
  if (entrada.tipo === "manual") {
    return [{ texto: entrada.texto, precioUsd: entrada.precioUsd, costoUsd: entrada.costoUsd }];
  }
  if (entrada.tipo === "celular") {
    return celulares
      .filter((e) => e.estado === "disponible")
      .filter(
        (e) => entrada.condiciones.length === 0 || entrada.condiciones.includes(e.condicion),
      )
      .map((e) => ({
        texto: `${e.modelo} ${e.almacenamiento} ${e.color}`,
        precioUsd: e.precioUsd,
        costoUsd: e.costoUsd,
      }));
  }
  if (entrada.tipo === "notebook") {
    return notebooks
      .filter((n) => n.estado === "disponible")
      .filter(
        (n) => entrada.condiciones.length === 0 || entrada.condiciones.includes(n.condicion),
      )
      .map((n) => ({
        texto: textoLineaNotebook(n),
        precioUsd: n.precioUsd,
        costoUsd: n.costoUsd,
      }));
  }
  return otros
    .filter((o) => o.categoria === entrada.categoria)
    .map((o) => ({ texto: o.nombre, precioUsd: o.precioUsd, costoUsd: otroCostoPromedio(o) }));
}

/** El descuento por monto fijo se resta del precio. El de porcentaje se
 * calcula sobre la ganancia (precioUsd - costoUsd), no sobre el precio —
 * un 10% de descuento no puede significar perder el 10% del precio de
 * venta si el margen es menor a eso. Sin costo, se asume que todo el
 * precio es ganancia (ítems manuales sin dato de costo). */
export function precioConDescuento(linea: Linea, lista: ListaDifusion): number {
  if (lista.descuentoTipo === "monto") return Math.max(0, linea.precioUsd - lista.descuentoValor);
  if (lista.descuentoTipo === "porcentaje") {
    const ganancia = linea.precioUsd - (linea.costoUsd ?? 0);
    return Math.max(0, Math.round(linea.precioUsd - ganancia * (lista.descuentoValor / 100)));
  }
  return linea.precioUsd;
}

export function totalItems(
  l: ListaDifusion,
  celulares: Celular[],
  otros: OtroItem[],
  notebooks: Notebook[] = [],
): number {
  return l.secciones.reduce(
    (a, s) =>
      a + s.entradas.flatMap((e) => expandirEntrada(e, celulares, otros, notebooks)).length,
    0,
  );
}

export function buildMensaje(
  lista: ListaDifusion,
  celulares: Celular[],
  otros: OtroItem[],
  notebooks: Notebook[] = [],
): string {
  const partes: string[] = [];
  if (lista.mensajeInicial.trim()) partes.push(lista.mensajeInicial.trim());
  for (const sec of lista.secciones) {
    const lineas = sec.entradas.flatMap((e) => expandirEntrada(e, celulares, otros, notebooks));
    if (lineas.length === 0) continue;
    partes.push("");
    partes.push(sec.nombre.trim().toUpperCase() || "SIN NOMBRE");
    partes.push("");
    for (const linea of lineas) {
      partes.push(`${sec.emoji} ${linea.texto} - ${fmtUsd(precioConDescuento(linea, lista))}`);
    }
  }
  if (lista.mensajeFinal.trim()) {
    partes.push("");
    partes.push(lista.mensajeFinal.trim());
  }
  return partes.join("\n");
}

/** Texto «para publicar» de UN celular (botón 📋 de Inventario): listo para
 *  pegar en WhatsApp / redes. **Nunca** incluye costo, IMEI ni notas internas
 *  -- solo lo que se le puede mostrar al cliente. */
export function copyCelular(c: Celular): string {
  const nuevo = c.condicion.trim().toUpperCase() === "NUEVO";
  const titulo = [c.modelo, c.almacenamiento, c.color].filter(Boolean).join(" ");
  const partes = [`📱 ${titulo}${!nuevo && c.bateria > 0 ? ` 🔋${c.bateria}%` : ""}`];
  if (!nuevo && c.condicion.trim()) partes.push(`Estética: ${c.condicion.trim()}`);
  partes.push(fmtUsd(c.precioUsd).replace("U$ ", "U$"));
  return partes.join(" - ");
}

/** Texto «para publicar» de UNA notebook, en una sola línea. Solo datos con
 *  valor; sin costo, número de serie ni notas internas. */
export function copyNotebook(n: Notebook): string {
  const partes = [
    n.modelo,
    n.pantalla,
    n.cpu,
    n.almacenamiento,
    n.memoria,
    n.condicion === "usado"
      ? `Usada${n.bateria !== null ? ` 🔋${n.bateria}%` : ""}`
      : "Nuevo",
    n.color,
  ].filter(Boolean);
  partes.push(fmtUsd(n.precioUsd).replace("U$ ", "U$"));
  return `💻 ${partes.join(" - ")}`;
}
