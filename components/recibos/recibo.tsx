"use client";

import { Printer } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { negocio } from "@/lib/mock-data";
import { fmtUsd } from "@/lib/format";

/** Hoja del recibo, con el estilo del sistema. Es lo único que se imprime. */
function ReciboShell({
  titulo,
  nro,
  fecha,
  children,
}: {
  titulo: string;
  nro: string;
  fecha: string;
  children: React.ReactNode;
}) {
  return (
    <div className="recibo-print rounded-xl border border-neutral-200 bg-white p-6 text-neutral-900">
      <div className="flex items-start justify-between border-b-2 border-accent pb-4">
        <div>
          <p className="text-xl font-bold uppercase tracking-wide text-accent">
            Tekly
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {negocio.nombre} · {negocio.direccion}
          </p>
          <p className="text-xs text-neutral-500">
            CUIT {negocio.cuit} · {negocio.telefono}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            {titulo}
          </p>
          <p className="text-lg font-bold tabular-nums">{nro}</p>
          <p className="text-xs text-neutral-500">{fecha}</p>
        </div>
      </div>

      <div className="py-5 text-sm">{children}</div>

      <div className="mt-10 grid grid-cols-2 gap-10 text-xs text-neutral-500">
        <div className="border-t border-neutral-400 pt-1 text-center">
          Firma del cliente · aclaración
        </div>
        <div className="border-t border-neutral-400 pt-1 text-center">
          Firma y sello — Tekly
        </div>
      </div>
      <p className="mt-4 text-[10px] text-neutral-400">
        Documento no válido como factura. Comprobante interno de{" "}
        {titulo.toLowerCase()}.
      </p>
    </div>
  );
}

export function ReciboDialog({
  open,
  onClose,
  titulo,
  nro,
  fecha,
  children,
}: {
  open: boolean;
  onClose: () => void;
  titulo: string;
  nro: string;
  fecha: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={titulo}
      description={`${nro} · ${fecha}`}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Imprimir / Guardar PDF
          </Button>
        </>
      }
    >
      <ReciboShell titulo={titulo} nro={nro} fecha={fecha}>
        {children}
      </ReciboShell>
    </Dialog>
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

export function ReciboLineas({
  titulo,
  lineas,
  total,
}: {
  titulo: string;
  lineas: { detalle: string; cantidad?: number; montoUsd: number }[];
  total?: number;
}) {
  return (
    <div className="mt-5">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
        {titulo}
      </p>
      <table className="w-full border border-neutral-200 text-sm">
        <tbody>
          {lineas.map((l, i) => (
            <tr key={i} className="border-b border-neutral-100 last:border-b-0">
              <td className="px-3 py-2 text-start">
                {l.cantidad ? `${l.cantidad}× ` : ""}
                {l.detalle}
              </td>
              <td className="px-3 py-2 text-right font-medium tabular-nums">
                {fmtUsd(l.montoUsd)}
              </td>
            </tr>
          ))}
          {total !== undefined && (
            <tr className="border-t border-neutral-300 font-bold">
              <td className="px-3 py-2 text-start uppercase">Total</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {fmtUsd(total)}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
