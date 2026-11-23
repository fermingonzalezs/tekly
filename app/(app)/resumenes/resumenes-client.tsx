"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/field";
import { ChartTitle } from "@/components/ui/chart-title";
import { fmtUsd } from "@/lib/format";
import { fmtDateSlash } from "@/lib/format";
import { etiquetaPeriodo, periodoAnteriorA } from "@/lib/resumen-mensual";
import type { ResumenGuardado } from "@/lib/db/resumenes";
import { generarResumenAction } from "./actions";

/** Cuántos meses hacia atrás se ofrecen en «Generar resumen». */
const MESES_GENERABLES = 12;

export function ResumenesClient({
  resumenes,
  mesActual,
  mesACerrar,
}: {
  resumenes: ResumenGuardado[];
  /** `YYYY-MM` del mes en curso (hora argentina). */
  mesActual: string;
  /** Mes que el cron cierra el próximo día 1. */
  mesACerrar: string;
}) {
  const router = useRouter();
  const [generando, setGenerando] = useState(false);

  // Meses ofrecidos: del último cerrado hacia atrás (el mes en curso no se
  // resume: todavía está abierto).
  const opciones = useMemo(() => {
    const out: string[] = [];
    let p = periodoAnteriorA(mesActual);
    for (let i = 0; i < MESES_GENERABLES; i++) {
      out.push(p);
      p = periodoAnteriorA(p);
    }
    return out;
  }, [mesActual]);

  return (
    <div className="space-y-5">
      <p className="text-sm text-neutral-500">
        Al cerrar cada mes se guarda solo un resumen con los números de ese mes (ventas,
        reparaciones, caja, inventario, clientes, patrimonio…). Queda congelado: no cambia
        aunque después se borre o edite algo.
      </p>

      <div className="flex justify-end">
        <Button icon={Plus} variant="tonal" onClick={() => setGenerando(true)}>
          Generar resumen de un mes
        </Button>
      </div>

      <Card className="overflow-x-auto">
        <div className="px-5 pt-5">
          <ChartTitle align="left" divider sub={`${resumenes.length} guardados`}>
            Historial mensual
          </ChartTitle>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-xs">
              <th className="px-5 py-3">Mes</th>
              <th className="px-5 py-3">Facturado</th>
              <th className="px-5 py-3">Ganancia</th>
              <th className="px-5 py-3">Reparaciones</th>
              <th className="px-5 py-3">Compras</th>
              <th className="px-5 py-3">Patrimonio</th>
              <th className="px-5 py-3">Generado</th>
            </tr>
          </thead>
          <tbody>
            {resumenes.map((r) => (
              <tr
                key={r.periodo}
                tabIndex={0}
                onClick={() => router.push(`/resumenes/${r.periodo}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") router.push(`/resumenes/${r.periodo}`);
                }}
                className="cursor-pointer border-t border-neutral-100 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
              >
                <td className="px-5 py-2 font-medium capitalize text-neutral-800">
                  {etiquetaPeriodo(r.periodo)}
                </td>
                <td className="px-5 py-2 tabular-nums">
                  {fmtUsd(r.facturadoUsd)}
                  <span className="block text-xs text-neutral-500">{r.ventasCantidad} ventas</span>
                </td>
                <td className="px-5 py-2 tabular-nums">
                  {r.gananciaUsd === null ? "—" : fmtUsd(r.gananciaUsd)}
                </td>
                <td className="px-5 py-2 tabular-nums">{fmtUsd(r.cobradoReparacionesUsd)}</td>
                <td className="px-5 py-2 tabular-nums">{fmtUsd(r.comprasUsd)}</td>
                <td className="px-5 py-2 tabular-nums">
                  {r.patrimonioUsd === null ? "—" : fmtUsd(r.patrimonioUsd)}
                </td>
                <td className="px-5 py-2 text-xs text-neutral-500">
                  {fmtDateSlash(r.generadoAt)}
                  <span className="mt-0.5 flex items-center justify-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-0.5 text-neutral-700">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${r.fotoFiable ? "bg-emerald-500" : "bg-amber-500"}`}
                      />
                      {r.origen === "cron" ? "Automático" : "Manual"}
                    </span>
                  </span>
                </td>
              </tr>
            ))}
            {resumenes.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm text-neutral-500">
                  Todavía no hay resúmenes. El primero se guarda solo el día 1 (cierra{" "}
                  {etiquetaPeriodo(mesACerrar)}), o podés generarlo ahora.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <GenerarDialog
        key={generando ? "generar-open" : "generar-none"}
        open={generando}
        onClose={() => setGenerando(false)}
        opciones={opciones}
        existentes={new Set(resumenes.map((r) => r.periodo))}
        congelados={new Set(resumenes.filter((r) => r.fotoFiable).map((r) => r.periodo))}
        sugerido={mesACerrar}
        onListo={(p) => {
          setGenerando(false);
          router.push(`/resumenes/${p}`);
        }}
      />
    </div>
  );
}

function GenerarDialog({
  open,
  onClose,
  opciones,
  existentes,
  congelados,
  sugerido,
  onListo,
}: {
  open: boolean;
  onClose: () => void;
  opciones: string[];
  existentes: Set<string>;
  /** Meses ya cerrados con foto fiel: no se pueden regenerar. */
  congelados: Set<string>;
  sugerido: string;
  onListo: (periodo: string) => void;
}) {
  const libres = opciones.filter((p) => !congelados.has(p));
  const [periodo, setPeriodo] = useState(
    libres.includes(sugerido) ? sugerido : (libres[0] ?? opciones[0]),
  );
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const yaExiste = existentes.has(periodo);

  function generar() {
    setError("");
    startTransition(async () => {
      const r = await generarResumenAction(periodo);
      if (r.ok) onListo(periodo);
      else setError(r.error);
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Generar resumen de un mes"
      description="Se arma con los datos que hay ahora."
      footer={
        <>
          <Button variant="outline" onClick={onClose} fullOnMobile>
            Cancelar
          </Button>
          <Button
            variant="primary"
            loading={pending}
            disabled={congelados.has(periodo)}
            onClick={generar}
            fullOnMobile
          >
            {pending ? "Generando…" : yaExiste ? "Regenerar" : "Generar"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Mes">
          <Select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            aria-label="Mes a resumir"
          >
            {opciones.map((p) => (
              <option key={p} value={p} disabled={congelados.has(p)}>
                {etiquetaPeriodo(p)}
                {congelados.has(p) ? " (cerrado)" : existentes.has(p) ? " (generado a mano)" : ""}
              </option>
            ))}
          </Select>
        </Field>
        <p className="text-sm text-neutral-500">
          Ventas, reparaciones, compras y caja salen de las fechas del mes y son exactos. El
          inventario, los saldos y el patrimonio son una foto del <strong>momento en que se
          genera</strong>: en un mes que ya pasó no reflejan el cierre real, y el resumen queda
          marcado con un punto ámbar.
        </p>
        {yaExiste && (
          <p className="text-sm text-amber-700">
            Este mes ya tiene resumen: generarlo de nuevo reemplaza el guardado.
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Dialog>
  );
}
