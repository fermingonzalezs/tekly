"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { chartColor } from "@/lib/chart";
import { fmtUsd } from "@/lib/format";
import type { VentaReciente } from "@/lib/dashboard";

/** "Ventas recientes" del dashboard de admin, en tabla: cada fila abre el
 * detalle (`<ventasHref>?open=<id>`). Debajo de `md` se apila en lista. */
export function VentasRecientesTabla({
  sales,
  ventasHref = "/ventas",
}: {
  sales: VentaReciente[];
  ventasHref?: string;
}) {
  const router = useRouter();
  const hrefDe = (id: string) => `${ventasHref}?open=${encodeURIComponent(id)}`;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <ChartTitle align="left" sub="Las últimas operaciones del local · tocá una para ver el detalle">
          Ventas recientes
        </ChartTitle>
        <Link
          href={ventasHref}
          className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-accent hover:underline"
        >
          Ver todas las ventas
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {sales.length === 0 ? (
        <p className="mx-5 mb-5 mt-3 border-t border-neutral-100 py-8 text-center text-sm text-neutral-500">
          Todavía no hay ventas
        </p>
      ) : (
        <>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs">
                  <th>Cliente</th>
                  <th>Producto</th>
                  <th>Rubro</th>
                  <th>Vendedor</th>
                  <th>Monto</th>
                  <th>Cuándo</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr
                    key={s.id}
                    className="cursor-pointer hover:bg-accent-soft"
                    onClick={() => router.push(hrefDe(s.id))}
                  >
                    <td className="px-4 py-2.5 font-medium text-neutral-900">
                      <Link href={hrefDe(s.id)} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                        {s.cliente}
                      </Link>
                    </td>
                    <td className="max-w-[18rem] truncate px-4 py-2.5 text-neutral-700" title={s.item}>
                      {s.item}
                    </td>
                    <td className="px-4 py-2.5">
                      <Rubro label={s.rubro} idx={s.rubroIdx} />
                    </td>
                    <td className="px-4 py-2.5 text-neutral-700">{s.vendedor}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-semibold tabular-nums">{fmtUsd(s.monto)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-neutral-500">{s.hace}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mt-3 divide-y divide-neutral-100 border-t border-neutral-100 md:hidden">
            {sales.map((s) => (
              <li key={s.id}>
                <Link
                  href={hrefDe(s.id)}
                  className="flex items-start justify-between gap-3 px-5 py-3 transition-colors hover:bg-neutral-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-900">{s.cliente}</p>
                    <p className="mt-0.5 truncate text-[13px] text-neutral-500">{s.item}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums">{fmtUsd(s.monto)}</p>
                    <p className="mt-0.5 whitespace-nowrap text-[11px] tabular-nums text-neutral-500">
                      {s.hace} · {s.vendedor}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function Rubro({ label, idx }: { label: string; idx: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: chartColor(Math.max(0, idx)) }} />
      {label}
    </span>
  );
}
