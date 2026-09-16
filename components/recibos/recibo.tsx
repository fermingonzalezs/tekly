"use client";

import { createPortal } from "react-dom";
import { Printer, ShieldCheck } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { negocio as negocioSeed } from "@/lib/mock-data";
import { fmtUsd } from "@/lib/format";

type Negocio = { nombre: string; direccion: string; telefono: string; cuit: string };

export type ReciboPagina = { titulo: string; children: React.ReactNode };

/** Una hoja individual -- lo que imprime `page-break-after` como una página
 * propia. Banda superior en `accent` con el nombre del negocio como hero (en
 * `font-grotesk`, mismo tratamiento que un número hero de `StatCard` --
 * este documento es de ELLOS, no de Tekly, así que la marca del negocio
 * lidera y "Tekly" queda como crédito chico en el pie) + bloque "A nombre
 * de" con el cliente y el título/número/fecha del documento -- las tablas
 * de `ReciboLineas`/`ReciboGarantiaItems` ya salen con el header índigo
 * oscuro de las tablas globales (`app/globals.css`), sin pedirlo a mano. */
function ReciboHoja({
  titulo,
  nro,
  fecha,
  cliente,
  negocio,
  children,
}: {
  titulo: string;
  nro: string;
  fecha: string;
  cliente: string;
  negocio: Negocio;
  children: React.ReactNode;
}) {
  return (
    <div className="recibo-print overflow-hidden rounded-xl border border-neutral-200 bg-white text-neutral-900">
      <div className="flex items-start justify-between gap-6 bg-accent px-6 py-5 text-white">
        <p className="font-grotesk text-2xl font-semibold tracking-tight">
          {negocio.nombre}
        </p>
        <div className="shrink-0 text-right text-xs text-white/70">
          <p>{negocio.direccion}</p>
          <p>
            CUIT {negocio.cuit} · {negocio.telefono}
          </p>
        </div>
      </div>

      <div className="px-6 py-5">
        <div className="flex items-start justify-between gap-6 border-b border-neutral-200 pb-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
              A nombre de
            </p>
            <p className="mt-1 text-sm font-semibold">{cliente}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-lg font-bold uppercase tracking-wide text-accent">
              {titulo}
            </p>
            <p className="text-xs text-neutral-500">{fecha}</p>
            <p className="text-xs font-medium tabular-nums text-neutral-500">{nro}</p>
          </div>
        </div>

        <div className="text-sm">{children}</div>

        <div className="mt-10 grid grid-cols-2 gap-10 text-xs text-neutral-500">
          <div className="border-t border-neutral-300 pt-1 text-center">
            Firma del cliente · aclaración
          </div>
          <div className="border-t border-neutral-300 pt-1 text-center">
            Firma y sello — {negocio.nombre}
          </div>
        </div>
        <p className="mt-4 text-[10px] text-neutral-400">
          Documento no válido como factura. Comprobante interno de{" "}
          {titulo.toLowerCase()}. · {negocio.telefono} · generado con Tekly
        </p>
      </div>
    </div>
  );
}

/** Wrapper de impresión: una o varias `ReciboHoja` (`paginas`, ej.
 * comprobante + garantía de una misma venta) o el uso de siempre de una
 * sola hoja (`titulo` + `children`). Cada hoja imparte su propia página --
 * ver `.recibo-print`/`.recibo-print-root` en `app/globals.css`. */
export function ReciboShell({
  paginas,
  titulo,
  nro,
  fecha,
  cliente,
  negocio = negocioSeed,
  children,
}: {
  paginas?: ReciboPagina[];
  titulo?: string;
  nro: string;
  fecha: string;
  cliente: string;
  negocio?: Negocio;
  children?: React.ReactNode;
}) {
  const hojas = paginas ?? [{ titulo: titulo ?? "", children }];
  const multi = hojas.length > 1;
  return (
    <div>
      {hojas.map((h, i) => (
        <div key={i} className={i > 0 ? "mt-4" : undefined}>
          {multi && (
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 print:hidden">
              Página {i + 1} de {hojas.length} · {h.titulo}
            </p>
          )}
          <ReciboHoja titulo={h.titulo} nro={nro} fecha={fecha} cliente={cliente} negocio={negocio}>
            {h.children}
          </ReciboHoja>
        </div>
      ))}
    </div>
  );
}

export function ReciboDialog({
  open,
  onClose,
  titulo,
  nro,
  fecha,
  cliente,
  negocio,
  paginas,
  children,
}: {
  open: boolean;
  onClose: () => void;
  titulo: string;
  nro: string;
  fecha: string;
  cliente: string;
  negocio?: Negocio;
  paginas?: ReciboPagina[];
  children?: React.ReactNode;
}) {
  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        size="lg"
        accent
        title={titulo}
        description={`${nro} · ${fecha}`}
        footer={
          <>
            <button
              onClick={onClose}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
            >
              Cerrar
            </button>
            <button
              onClick={() => window.print()}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-accent/40 px-4 text-sm font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft"
            >
              <Printer className="h-4 w-4" /> Imprimir / Guardar PDF
            </button>
          </>
        }
      >
        <ReciboShell
          titulo={titulo}
          nro={nro}
          fecha={fecha}
          cliente={cliente}
          negocio={negocio}
          paginas={paginas}
        >
          {children}
        </ReciboShell>
      </Dialog>
      {/* Copia fuera del Dialog, hija directa de `body` -- así la impresión
       * (`app/globals.css`, `#recibo-print-root`) queda en flujo normal y
       * puede paginar varias hojas sin heredar el `fixed`/scroll del Dialog. */}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div id="recibo-print-root">
            <ReciboShell
              titulo={titulo}
              nro={nro}
              fecha={fecha}
              cliente={cliente}
              negocio={negocio}
              paginas={paginas}
            >
              {children}
            </ReciboShell>
          </div>,
          document.body,
        )}
    </>
  );
}

// ── Bloques reutilizables para el cuerpo del recibo ────────────

export function ReciboCampos({
  filas,
}: {
  filas: [string, React.ReactNode][];
}) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5">
      {filas.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-neutral-400">{k}</dt>
          <dd className="font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Tabla de ítems del recibo. `serial` es opcional por línea -- en cuanto
 * alguna lo trae, la tabla pasa a columnas explícitas (Ítem/Serial/Cant./
 * Total) con header; si ninguna lo trae, queda el formato compacto de
 * siempre ("2× Detalle" + un monto), sin romper los usos existentes
 * (servicios de Reparaciones, forma de pago) que no tienen serial. */
export function ReciboLineas({
  titulo,
  lineas,
  total,
}: {
  titulo: string;
  lineas: { detalle: string; cantidad?: number; montoUsd: number; serial?: string }[];
  total?: number;
}) {
  const conSerial = lineas.some((l) => l.serial);
  return (
    <div className="mt-5">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
        {titulo}
      </p>
      <table className="w-full border border-neutral-200 text-sm">
        {conSerial && (
          <thead>
            <tr>
              <th className="px-3 py-2 text-start">Ítem</th>
              <th className="px-3 py-2 text-start">Serial</th>
              <th className="px-3 py-2 text-center">Cant.</th>
              <th className="px-3 py-2 text-end">Total</th>
            </tr>
          </thead>
        )}
        <tbody>
          {lineas.map((l, i) => (
            <tr key={i} className="border-b border-neutral-100 last:border-b-0">
              <td className="px-3 py-2 text-start">
                {!conSerial && l.cantidad ? `${l.cantidad}× ` : ""}
                {l.detalle}
              </td>
              {conSerial && (
                <td className="px-3 py-2 text-start font-mono text-[11px] tabular-nums text-neutral-500">
                  {l.serial ?? "—"}
                </td>
              )}
              {conSerial && (
                <td className="px-3 py-2 text-center tabular-nums text-neutral-500">
                  {l.cantidad ?? 1}
                </td>
              )}
              <td className="px-3 py-2 text-end font-medium tabular-nums">
                {fmtUsd(l.montoUsd)}
              </td>
            </tr>
          ))}
          {total !== undefined && (
            <tr className="border-t border-neutral-300">
              <td
                className="px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-neutral-500"
                colSpan={conSerial ? 3 : 1}
              >
                Total
              </td>
              <td className="px-3 py-2 text-end font-grotesk text-base font-semibold tabular-nums">
                {fmtUsd(total)}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Tabla de ítems del recibo de garantía: a diferencia de `ReciboLineas`,
 * cada línea lleva su propio texto de garantía y no hay fila de total (la
 * garantía no es un monto a cobrar). */
export function ReciboGarantiaItems({
  items,
}: {
  items: { detalle: string; serial?: string; garantia: string; precioUsd: number }[];
}) {
  return (
    <div className="mt-5">
      <table className="w-full border border-neutral-200 text-sm">
        <thead>
          <tr>
            <th className="px-3 py-2 text-start">Ítem</th>
            <th className="px-3 py-2 text-start">Serial</th>
            <th className="px-3 py-2 text-start">Garantía</th>
            <th className="px-3 py-2 text-end">Precio</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i} className="border-b border-neutral-100 last:border-b-0">
              <td className="px-3 py-2 text-start">{it.detalle}</td>
              <td className="px-3 py-2 text-start font-mono text-[11px] tabular-nums text-neutral-500">
                {it.serial ?? "—"}
              </td>
              <td className="px-3 py-2 text-start text-neutral-500">{it.garantia}</td>
              <td className="px-3 py-2 text-end font-medium tabular-nums">
                {fmtUsd(it.precioUsd)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const NOTA_TONE = {
  accent: "bg-accent text-white",
  warning: "bg-amber-500 text-white",
} as const;

/** Bloque de nota con header de color y cuerpo gris -- párrafos separados
 * por línea en blanco. `tono="warning"` (ámbar, mismo tono semántico que
 * `lib/status.ts` usa para urgencia en el resto de la app) para una nota
 * de advertencia como "Importante"; `null` si no hay texto cargado
 * (Configuración → Recibos), en vez de mostrar un bloque vacío. */
export function ReciboNota({
  titulo,
  texto,
  tono = "accent",
}: {
  titulo: string;
  texto: string;
  tono?: keyof typeof NOTA_TONE;
}) {
  const parrafos = texto
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parrafos.length === 0) return null;
  return (
    <div className="mt-5 overflow-hidden rounded-lg border border-neutral-200">
      <p
        className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider ${NOTA_TONE[tono]}`}
      >
        {titulo}
      </p>
      <div className="space-y-2 bg-neutral-50 px-3 py-3 text-xs leading-relaxed text-neutral-600">
        {parrafos.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </div>
  );
}

/** Variante en lista de `ReciboNota` -- una causal por línea de texto. */
export function ReciboNotaLista({
  titulo,
  texto,
  tono = "accent",
}: {
  titulo: string;
  texto: string;
  tono?: keyof typeof NOTA_TONE;
}) {
  const items = texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (items.length === 0) return null;
  return (
    <div className="mt-5 overflow-hidden rounded-lg border border-neutral-200">
      <p
        className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider ${NOTA_TONE[tono]}`}
      >
        {titulo}
      </p>
      <ul className="list-disc space-y-1 bg-neutral-50 px-3 py-3 pl-7 text-xs leading-relaxed text-neutral-600">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

/** Sello de garantía -- el único gesto "de más" del recibo de Garantía,
 * a propósito nada más lo tiene: un sello de goma es lo que un cliente
 * reconoce como respaldo real en un papel de garantía. Insignia en línea
 * (no `position: absolute`) para no depender de cómo cada motor de
 * impresión del navegador resuelve el posicionamiento absoluto en print. */
export function ReciboSello() {
  return (
    <div className="mt-4 flex justify-end">
      <div className="flex h-20 w-20 -rotate-12 flex-col items-center justify-center rounded-full border-2 border-dashed border-accent/40 text-accent">
        <ShieldCheck className="h-5 w-5" />
        <p className="mt-1 text-[8px] font-bold uppercase tracking-widest">Garantía</p>
      </div>
    </div>
  );
}
