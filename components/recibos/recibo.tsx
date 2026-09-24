"use client";

import { createPortal } from "react-dom";
import { Printer, ShieldCheck, Store } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { negocio as negocioSeed } from "@/lib/mock-data";
import { fmtUsd } from "@/lib/format";
import { CHECKLIST_ITEMS, checklistItemLabel, estadoChecklistItem, dotClass } from "@/lib/status";
import type { Checklist, EstadoChecklistItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type Negocio = { nombre: string; direccion: string; telefono: string; cuit: string };

export type ReciboPagina = {
  titulo: string;
  children: React.ReactNode;
  /** Hoja "compacta": en vez de las dos tarjetas "Facturado por"/
   * "Facturado a" (pensadas para un comprobante), el negocio pasa a la
   * banda superior (donde iría el logo) y el cliente queda en una única
   * tarjeta "Información cliente" -- para documentos que no son una
   * factura (Garantía de Ventas, tickets de Reparaciones). */
  compacto?: boolean;
  /** Sello de garantía superpuesto sobre "Información cliente" -- solo
   * tiene sentido con `compacto`, y solo lo usa el documento de Garantía
   * de Ventas (no los tickets de Reparaciones). */
  sello?: boolean;
};

/** Teléfono/email del cliente debajo de su nombre, en "Facturado a" /
 * "Información cliente" -- `undefined`/`"—"` (placeholder de
 * `listClientesOpciones` cuando el dato no está cargado) no se muestran. */
function ReciboClienteContacto({
  telefono,
  email,
}: {
  telefono?: string;
  email?: string;
}) {
  const datos = [telefono, email].filter((v) => v && v !== "—");
  if (datos.length === 0) return null;
  return <p className="mt-1 text-xs text-neutral-500">{datos.join(" · ")}</p>;
}

/** Líneas de firma del pie de hoja -- también se usa sola, inline en el
 * cuerpo (ej. ticket de egreso: las firmas van arriba, en la primera
 * hoja, y el detalle después). */
export function ReciboFirmas({ negocio }: { negocio: Negocio }) {
  return (
    <div className="grid grid-cols-2 gap-10 text-xs text-neutral-500">
      <div className="border-t border-neutral-300 pt-3 text-center">
        Firma del cliente · aclaración
      </div>
      <div className="border-t border-neutral-300 pt-3 text-center">
        Firma y sello — {negocio.nombre}
      </div>
    </div>
  );
}

/** Una hoja individual -- lo que imprime `page-break-after` como una página
 * propia. Banda superior en `accent` con el título/número/fecha del
 * documento en blanco + un ícono placeholder de logo a la derecha (todavía
 * no hay campo de logo real en Configuración), o los datos del negocio si
 * `compacto` + dos tarjetas "Facturado por"/"Facturado a" (negocio /
 * cliente), o una única "Información cliente" (+ `sello` opcional) si
 * `compacto` -- las tablas de `ReciboLineas`/`ReciboGarantiaItems` ya salen
 * con el header índigo oscuro de las tablas globales (`app/globals.css`),
 * sin pedirlo a mano. */
function ReciboHoja({
  titulo,
  nro,
  fecha,
  cliente,
  clienteTelefono,
  clienteEmail,
  negocio,
  compacto = false,
  sello = false,
  sinFirmas = false,
  children,
}: {
  titulo: string;
  nro: string;
  fecha: string;
  cliente: string;
  clienteTelefono?: string;
  clienteEmail?: string;
  negocio: Negocio;
  compacto?: boolean;
  sello?: boolean;
  /** Sin el bloque de firmas al pie -- para documentos que firman "en el
   * cuerpo" (ej. el ticket de egreso de Reparaciones pone las firmas
   * arriba, en la primera hoja, y el detalle después). */
  sinFirmas?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="recibo-print flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white text-neutral-900 print:min-h-screen">
      <div className="flex items-center justify-between gap-6 bg-accent px-8 py-6 text-white print:px-[14mm] print:py-8">
        <div>
          <p className="font-grotesk text-3xl font-semibold uppercase tracking-tight">{titulo}</p>
          <p className="mt-2 font-grotesk text-xs tabular-nums text-white/80">
            {fecha} - {nro}
          </p>
        </div>
        {compacto ? (
          <div className="shrink-0 text-right">
            <p className="font-grotesk text-sm font-semibold">{negocio.nombre}</p>
            <p className="text-[11px] text-white/70">{negocio.direccion}</p>
            <p className="text-[11px] text-white/70">
              CUIT {negocio.cuit} · {negocio.telefono}
            </p>
          </div>
        ) : (
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/15">
            <Store className="h-6 w-6" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col px-6 py-5 print:px-[14mm] print:py-8 print:pb-16">
        {compacto ? (
          <div className="relative">
            <p className="mb-3 border-b border-accent/20 pb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-accent">
              Información cliente
            </p>
            <div className="rounded-lg bg-accent-soft p-4 text-center">
              <p className="font-grotesk text-base font-semibold">{cliente}</p>
              <ReciboClienteContacto telefono={clienteTelefono} email={clienteEmail} />
            </div>
            {sello && (
              <div className="absolute -top-4 -right-2">
                <ReciboSello />
              </div>
            )}
          </div>
        ) : (
          <div>
            <p className="mb-3 border-b border-accent/20 pb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-accent">
              Datos de facturación
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-accent-soft p-4">
                <p className="text-center text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Facturado por
                </p>
                <div className="pt-3">
                  <p className="font-grotesk text-base font-semibold">{negocio.nombre}</p>
                  <p className="mt-1 text-xs text-neutral-500">{negocio.direccion}</p>
                  <p className="text-xs text-neutral-500">
                    CUIT {negocio.cuit} · {negocio.telefono}
                  </p>
                </div>
              </div>
              <div className="rounded-lg bg-accent-soft p-4">
                <p className="text-center text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Facturado a
                </p>
                <div className="pt-3">
                  <p className="font-grotesk text-base font-semibold">{cliente}</p>
                  <ReciboClienteContacto telefono={clienteTelefono} email={clienteEmail} />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="text-sm">{children}</div>

        {!sinFirmas && (
          <div className="mt-auto pt-10">
            <ReciboFirmas negocio={negocio} />
          </div>
        )}
      </div>

      <div className="recibo-print-footer flex shrink-0 items-center justify-center gap-1.5 bg-accent px-6 py-3 text-center print:px-[14mm]">
        <p className="text-[10px] text-white/70">
          Documento no válido como factura · Comprobante hecho con tekly.tech
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
  clienteTelefono,
  clienteEmail,
  negocio = negocioSeed,
  compacto,
  sello,
  sinFirmas,
  children,
}: {
  paginas?: ReciboPagina[];
  titulo?: string;
  nro: string;
  fecha: string;
  cliente: string;
  clienteTelefono?: string;
  clienteEmail?: string;
  negocio?: Negocio;
  /** Solo aplican al uso de una sola hoja (`titulo`+`children`, sin
   * `paginas`) -- con `paginas`, cada `ReciboPagina` trae los suyos. */
  compacto?: boolean;
  sello?: boolean;
  /** Se aplica a todas las hojas (ver `ReciboHoja`). */
  sinFirmas?: boolean;
  children?: React.ReactNode;
}) {
  const hojas = paginas ?? [{ titulo: titulo ?? "", children, compacto, sello }];
  const multi = hojas.length > 1;
  return (
    <div>
      {hojas.map((h, i) => (
        <div key={i} className={i > 0 ? "mt-4 print:mt-0" : undefined}>
          {multi && (
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 print:hidden">
              Página {i + 1} de {hojas.length} · {h.titulo}
            </p>
          )}
          <ReciboHoja
            titulo={h.titulo}
            nro={nro}
            fecha={fecha}
            cliente={cliente}
            clienteTelefono={clienteTelefono}
            clienteEmail={clienteEmail}
            negocio={negocio}
            compacto={h.compacto}
            sello={h.sello}
            sinFirmas={sinFirmas}
          >
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
  clienteTelefono,
  clienteEmail,
  negocio,
  compacto,
  sello,
  sinFirmas,
  paginas,
  children,
}: {
  open: boolean;
  onClose: () => void;
  titulo: string;
  nro: string;
  fecha: string;
  cliente: string;
  clienteTelefono?: string;
  clienteEmail?: string;
  negocio?: Negocio;
  compacto?: boolean;
  sello?: boolean;
  sinFirmas?: boolean;
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
          clienteTelefono={clienteTelefono}
          clienteEmail={clienteEmail}
          negocio={negocio}
          compacto={compacto}
          sello={sello}
          sinFirmas={sinFirmas}
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
              clienteTelefono={clienteTelefono}
              clienteEmail={clienteEmail}
              negocio={negocio}
              compacto={compacto}
              sello={sello}
              sinFirmas={sinFirmas}
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
  className = "mt-10 print:break-inside-avoid-page",
  separadores = false,
  variant = "grid",
}: {
  filas: [string, React.ReactNode][];
  /** Margen/comportamiento de corte del bloque -- default de siempre;
   * se pisa a `""` cuando va anidado dentro de otro bloque que ya pone su
   * propio margen (ej. dos `ReciboCampos` lado a lado en una grilla). */
  className?: string;
  /** Línea fina debajo de cada fila -- para listas más largas donde el
   * espaciado solo (`gap-y`) no alcanza para leerlas separadas (ej.
   * "Información del equipo" de Reparaciones). */
  separadores?: boolean;
  /** "inline" -- cada fila es un párrafo compacto "Label: valor" (mismo
   * tamaño/peso base para label y valor) en vez de la grilla de dos
   * columnas -- evita el hueco vacío que deja la columna `1fr` del valor
   * cuando el texto es corto (ej. "Marca: Apple"). */
  variant?: "grid" | "inline";
}) {
  if (variant === "inline") {
    return (
      <dl className={className}>
        {filas.map(([k, v]) => (
          <div
            key={k}
            className={cn("py-1.5 text-sm", separadores && "border-b border-neutral-100 last:border-b-0")}
          >
            <dt className="inline">{k}:</dt>{" "}
            <dd className="inline font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <dl className={cn(className, "grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5")}>
      {filas.map(([k, v]) => (
        <div key={k} className="contents">
          <dt
            className={cn(
              "text-neutral-400",
              separadores && "border-b border-neutral-100 pb-1.5",
            )}
          >
            {k}
          </dt>
          <dd
            className={cn("font-medium", separadores && "border-b border-neutral-100 pb-1.5")}
          >
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Tabla de ítems del recibo. `serial`/`garantia` son opcionales por línea
 * -- en cuanto alguna trae `serial`, la tabla pasa a columnas explícitas
 * (Producto/Serial/Cantidad/Precio) con header; si alguna trae `garantia`
 * se agrega esa columna también (ej. "Servicios utilizados" de
 * Reparaciones: Producto/Cantidad/Garantía/Precio, sin Serial). Si ninguna
 * trae ni una cosa ni la otra, queda el formato compacto de siempre
 * ("2× Detalle" + un monto). */
export function ReciboLineas({
  titulo,
  lineas,
  total,
  forzarTabla = false,
}: {
  titulo: string;
  lineas: {
    detalle: string;
    cantidad?: number;
    montoUsd: number;
    serial?: string;
    /** Garantía de este ítem puntual (ej. "90 días", "—") -- agrega la
     * columna Garantía a la tabla cuando alguna línea la trae. */
    garantia?: string;
    /** Texto ya formateado para la columna de monto -- pisa `fmtUsd(montoUsd)`
     * cuando el pago fue en otra moneda (ej. "Forma de pago" con un medio
     * en pesos: `montoUsd` sigue siendo el valor en dólares que se
     * concilia, pero acá hay que mostrar lo que el cliente entregó). */
    montoLabel?: string;
  }[];
  total?: number;
  /** Fuerza el formato de columnas (Producto/Serial/Cantidad/Precio) aunque
   * ninguna línea traiga `serial` -- el "Detalle" del comprobante de venta
   * lo necesita siempre, no solo cuando hay algún equipo con IMEI. */
  forzarTabla?: boolean;
}) {
  const conSerial = lineas.some((l) => l.serial);
  const conGarantia = lineas.some((l) => l.garantia !== undefined);
  const tabla = forzarTabla || conSerial || conGarantia;
  return (
    <div className="mt-10 print:break-inside-avoid-page">
      <p className="mb-2 border-b border-accent/20 pb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-accent">
        {titulo}
      </p>
      <table className="w-full border border-accent/15 text-sm">
        {tabla && (
          <thead>
            <tr className="divide-x divide-accent/15">
              <th className="px-3 py-2 text-start">Producto</th>
              {conSerial && <th className="px-3 py-2 text-center">Serial</th>}
              <th className="px-3 py-2 text-center">Cantidad</th>
              {conGarantia && <th className="px-3 py-2 text-center">Garantía</th>}
              <th className="px-3 py-2 text-center">Precio</th>
            </tr>
          </thead>
        )}
        <tbody>
          {lineas.map((l, i) => (
            <tr
              key={i}
              className="divide-x divide-accent/10 border-b border-accent/10 last:border-b-0"
            >
              <td className="px-3 py-2 text-start">
                {!tabla && l.cantidad ? `${l.cantidad}× ` : ""}
                {l.detalle}
              </td>
              {conSerial && (
                <td className="px-3 py-2 text-center font-mono text-[11px] tabular-nums text-neutral-500">
                  {l.serial ?? "—"}
                </td>
              )}
              {tabla && (
                <td className="px-3 py-2 text-center tabular-nums text-neutral-500">
                  {l.cantidad ?? 1}
                </td>
              )}
              {conGarantia && (
                <td className="px-3 py-2 text-center text-neutral-500">{l.garantia ?? "—"}</td>
              )}
              <td
                className={`px-3 py-2 font-medium tabular-nums ${tabla ? "text-center" : "text-end"}`}
              >
                {l.montoLabel ?? fmtUsd(l.montoUsd)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {total !== undefined && (
        <div className="mt-2 flex items-center justify-between rounded-lg bg-accent/20 px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Total
          </span>
          <span className="font-grotesk text-lg font-semibold tabular-nums">
            {fmtUsd(total)}
          </span>
        </div>
      )}
    </div>
  );
}

/** Tabla de ítems del recibo de garantía: a diferencia de `ReciboLineas`,
 * cada línea lleva su propio texto de garantía y no hay fila de total (la
 * garantía no es un monto a cobrar). */
export function ReciboGarantiaItems({
  items,
}: {
  items: { detalle: string; serial?: string; garantia: string }[];
}) {
  return (
    <div className="mt-10 print:break-inside-avoid-page">
      <table className="w-full border border-accent/15 text-sm">
        <thead>
          <tr className="divide-x divide-accent/15">
            <th className="px-3 py-2 text-start">Ítem</th>
            <th className="px-3 py-2 text-center">Serial</th>
            <th className="px-3 py-2 text-center">Garantía</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr
              key={i}
              className="divide-x divide-accent/10 border-b border-accent/10 last:border-b-0"
            >
              <td className="px-3 py-2 text-start">{it.detalle}</td>
              <td className="px-3 py-2 text-center font-mono text-[11px] tabular-nums text-neutral-500">
                {it.serial ?? "—"}
              </td>
              <td className="px-3 py-2 text-center text-neutral-500">{it.garantia}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Checklist de estado físico/funcional de un ticket de reparación (ingreso
 * o egreso) -- grilla de ítem + estado (Bien/Mal/N-A, mismo `dotClass` de
 * `lib/status.ts` que el resto de la app) más el color suelto al final,
 * ya que es un dato de identificación y no un chequeo. Un ítem sin estado
 * cargado (ticket de antes de esta feature, o casilla sin completar) sale
 * como "—". */
/** Badge de estado de un ítem del checklist -- "—" si no se cargó. Mismo
 * `dotClass` de `lib/status.ts` que el resto de la app. */
function EstadoChecklistBadge({ estado }: { estado?: EstadoChecklistItem }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-700">
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          dotClass[estado ? estadoChecklistItem[estado].tone : "gray"],
        )}
      />
      {estado ? estadoChecklistItem[estado].label : "—"}
    </span>
  );
}

export function ReciboChecklist({
  titulo,
  checklist,
  ocultarColor,
}: {
  titulo: string;
  checklist: Checklist;
  /** El color ya se muestra en "Información del equipo" (Ticket de
   * ingreso) -- no repetirlo acá abajo. */
  ocultarColor?: boolean;
}) {
  return (
    <div className="mt-10 print:break-inside-avoid-page">
      <p className="mb-3 border-b border-accent/20 pb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-accent">
        {titulo}
      </p>
      <div className="grid grid-cols-2 gap-x-6 sm:grid-cols-3">
        {CHECKLIST_ITEMS.map((id) => (
          <div
            key={id}
            className="flex items-center justify-between gap-2 border-b border-neutral-100 py-1 text-xs"
          >
            <span className="text-neutral-600">{checklistItemLabel[id]}</span>
            <EstadoChecklistBadge estado={checklist.items[id]} />
          </div>
        ))}
      </div>
      {!ocultarColor && checklist.color && (
        <p className="mt-3 text-xs text-neutral-500">
          <span className="font-semibold text-neutral-700">Color: </span>
          {checklist.color}
        </p>
      )}
    </div>
  );
}

/** Checklist combinado ingreso/egreso -- un ítem por fila, con el estado
 * relevado en cada momento uno al lado del otro (para el Presupuesto, que
 * se manda al cliente y quiere mostrar "antes y después" en una sola
 * tabla en vez de dos bloques separados). `undefined` en cualquiera de los
 * dos (ticket todavía sin ese checklist completado) sale como "—". */
export function ReciboChecklistComparado({
  ingreso,
  egreso,
}: {
  ingreso?: Checklist;
  egreso?: Checklist;
}) {
  if (!ingreso && !egreso) return null;
  const color = ingreso?.color || egreso?.color;
  return (
    <div className="mt-10 print:break-inside-avoid-page">
      <p className="mb-3 border-b border-accent/20 pb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-accent">
        Estado del equipo
      </p>
      <table className="w-full border border-accent/15 text-sm">
        <thead>
          <tr className="divide-x divide-accent/15">
            <th className="px-3 py-2 text-start">Ítem</th>
            <th className="px-3 py-2 text-center">Ingreso</th>
            <th className="px-3 py-2 text-center">Egreso</th>
          </tr>
        </thead>
        <tbody>
          {CHECKLIST_ITEMS.map((id) => (
            <tr
              key={id}
              className="divide-x divide-accent/10 border-b border-accent/10 last:border-b-0"
            >
              <td className="px-3 py-2 text-start text-neutral-600">
                {checklistItemLabel[id]}
              </td>
              <td className="px-3 py-2 text-center">
                <EstadoChecklistBadge estado={ingreso?.items[id]} />
              </td>
              <td className="px-3 py-2 text-center">
                <EstadoChecklistBadge estado={egreso?.items[id]} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {color && (
        <p className="mt-3 text-xs text-neutral-500">
          <span className="font-semibold text-neutral-700">Color: </span>
          {color}
        </p>
      )}
    </div>
  );
}

/** Bloque de nota -- mismo patrón título centrado + línea abajo que el
 * resto del documento (`ReciboLineas`, "Datos de facturación"), en violeta
 * igual que esos títulos. `tono="warning"` (ej. "Importante") rompe el
 * patrón a propósito: recuadro rojo claro para que resalte como
 * advertencia, en vez de mezclarse con el resto de las notas -- ver
 * `garantiaContenido` en Ventas, que la manda al final del documento por
 * eso mismo. `null` si no hay texto cargado (Configuración → Recibos), en
 * vez de mostrar un bloque vacío. */
export function ReciboNota({
  titulo,
  texto,
  tono = "accent",
}: {
  titulo: string;
  texto: string;
  tono?: "accent" | "warning";
}) {
  const parrafos = texto
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parrafos.length === 0) return null;
  if (tono === "warning") {
    return (
      <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 print:break-inside-avoid-page">
        <p className="mb-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-red-600">
          {titulo}
        </p>
        <div className="space-y-2 text-xs leading-relaxed text-red-700">
          {parrafos.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="mt-5 print:break-inside-avoid-page">
      <p className="mb-1.5 border-b border-accent/20 pb-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-accent">
        {titulo}
      </p>
      <div className="space-y-2 text-xs leading-relaxed text-neutral-600">
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
}: {
  titulo: string;
  texto: string;
}) {
  const items = texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (items.length === 0) return null;
  return (
    <div className="mt-5 print:break-inside-avoid-page">
      <p className="mb-1.5 border-b border-accent/20 pb-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-accent">
        {titulo}
      </p>
      <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-neutral-600">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

/** Sello de garantía -- el único gesto "de más" del recibo de Garantía, a
 * propósito nada más lo tiene: un sello de goma es lo que un cliente
 * reconoce como respaldo real en un papel de garantía. Se superpone (el
 * padre lo posiciona con `absolute`) sobre la tarjeta "Información
 * cliente" en vez de ocupar su propia fila -- fondo blanco para que se
 * note como sello encima, no mezclado con el violeta claro de la tarjeta. */
export function ReciboSello() {
  return (
    <div className="flex h-20 w-20 rotate-12 flex-col items-center justify-center rounded-full border-2 border-dashed border-accent/40 bg-white text-accent shadow-sm">
      <ShieldCheck className="h-5 w-5" />
      <p className="mt-1 text-[8px] font-bold uppercase tracking-widest">Garantía</p>
    </div>
  );
}
