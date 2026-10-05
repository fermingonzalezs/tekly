import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { cn } from "@/lib/utils";
import { fmtUsd } from "@/lib/format";
import type { VentaReciente } from "@/lib/dashboard";

/** Lista de últimas ventas: cada fila abre el detalle (`/ventas?open=<id>`)
 * y el footer linkea a la sección completa. Sin buscador ni filtros -- con
 * 6 filas no se justifica. */
export function RecentSales({
  className,
  sales,
  ventasHref = "/ventas",
}: {
  className?: string;
  sales: VentaReciente[];
  /** Base del link al detalle/lista de ventas (en demo `/demo/ventas`). */
  ventasHref?: string;
}) {
  return (
    <Card className={cn("flex min-h-0 flex-col overflow-hidden", className)}>
      <div className="shrink-0 px-4 pt-4">
        <ChartTitle align="left" sub="Seguimiento de las últimas ventas">
          Ventas recientes
        </ChartTitle>
        <div className="mt-3 border-t border-neutral-100" />
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <ul className="divide-y divide-neutral-100">
          {sales.slice(0, 6).map((s) => (
            <li key={s.id}>
              <Link
                href={`${ventasHref}?open=${encodeURIComponent(s.id)}`}
                className="flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-neutral-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-900">
                    {s.cliente}
                  </p>
                  <p className="mt-0.5 truncate text-[13px] text-neutral-500">
                    {s.item}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums">
                    {fmtUsd(s.monto)}
                  </p>
                  <p className="mt-0.5 whitespace-nowrap text-[11px] tabular-nums text-neutral-500">
                    {s.hace} · {s.vendedor}
                  </p>
                </div>
              </Link>
            </li>
          ))}
          {sales.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-neutral-500">
              Todavía no hay ventas
            </li>
          )}
        </ul>
      </div>

      <div className="shrink-0 border-t border-neutral-100 px-4 py-2.5">
        <Link
          href={ventasHref}
          className="inline-flex items-center gap-1 text-[13px] font-medium text-accent transition-colors hover:underline"
        >
          Ver todas
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Card>
  );
}
