import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { CHART_COLORS } from "@/lib/chart";
import { fmtUsd } from "@/lib/format";
import type { ModalidadVenta } from "@/lib/types";
import type { ResumenModalidad } from "@/lib/ventas";

/** Color fijo por modalidad (identidad estable entre períodos). */
const COLOR: Record<ModalidadVenta, string> = {
  minorista: CHART_COLORS[0],
  mayorista: CHART_COLORS[2],
};

/** Minorista vs mayorista: barra 100 % apilada con la parte de cada una en la
 * facturación + comparación de facturación/operaciones/ticket/margen. */
export function ModalidadSplit({ data }: { data: ResumenModalidad[] }) {
  const total = data.reduce((a, r) => a + r.facturacion, 0);

  const filas: { label: string; valor: (r: ResumenModalidad) => string }[] = [
    { label: "Facturación", valor: (r) => fmtUsd(Math.round(r.facturacion)) },
    { label: "Operaciones", valor: (r) => String(r.operaciones) },
    { label: "Ticket promedio", valor: (r) => (r.operaciones ? fmtUsd(Math.round(r.ticketPromedio)) : "—") },
    { label: "Margen", valor: (r) => (r.margenPct !== null ? `${r.margenPct.toFixed(1)}%` : "—") },
  ];

  return (
    <Card className="p-5">
      <ChartTitle align="left" divider sub="facturación del período por tipo de venta">
        Minorista vs mayorista
      </ChartTitle>

      {total === 0 ? (
        <p className="py-10 text-center text-sm text-neutral-500">Sin ventas en el período</p>
      ) : (
        <>
          <div
            className="mt-2 flex h-9 w-full overflow-hidden rounded-md bg-neutral-100"
            role="img"
            aria-label={data.map((r) => `${r.label} ${r.pct.toFixed(0)}%`).join(", ")}
          >
            {data
              .filter((r) => r.pct > 0)
              .map((r, i) => (
                <div
                  key={r.modalidad}
                  className={`flex h-full items-center justify-center ${i > 0 ? "border-l-2 border-white" : ""}`}
                  style={{ width: `${r.pct}%`, background: COLOR[r.modalidad] }}
                >
                  {r.pct >= 12 && (
                    <span
                      className="rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white"
                      style={{ background: "rgba(255,255,255,.25)" }}
                    >
                      {r.pct.toFixed(0)}%
                    </span>
                  )}
                </div>
              ))}
          </div>

          <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-6 gap-y-2.5 text-sm">
            <span />
            {data.map((r) => (
              <span
                key={r.modalidad}
                className="flex items-center justify-end gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500"
              >
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR[r.modalidad] }} />
                {r.label}
              </span>
            ))}
            {filas.map((f) => (
              <Fila key={f.label} label={f.label} valores={data.map(f.valor)} />
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

function Fila({ label, valores }: { label: string; valores: string[] }) {
  return (
    <>
      <span className="border-t border-neutral-100 pt-2.5 text-neutral-500">{label}</span>
      {valores.map((v, i) => (
        <span
          key={i}
          className="border-t border-neutral-100 pt-2.5 text-right font-semibold tabular-nums text-neutral-900"
        >
          {v}
        </span>
      ))}
    </>
  );
}
