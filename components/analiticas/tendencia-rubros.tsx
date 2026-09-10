"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { cn } from "@/lib/utils";
import { salesByMonth } from "@/lib/mock-data";
import { fmtUsd } from "@/lib/format";
import { chartColor } from "@/lib/chart";

type CatKey = "equipos" | "reparaciones" | "accesorios" | "otros";

const CATS: { key: CatKey; label: string; color: string }[] = [
  { key: "equipos", label: "Equipos", color: chartColor(0) },
  { key: "reparaciones", label: "Reparaciones", color: chartColor(1) },
  { key: "accesorios", label: "Accesorios", color: chartColor(2) },
  { key: "otros", label: "Otros", color: chartColor(3) },
];
const COLOR: Record<CatKey, string> = {
  equipos: chartColor(0),
  reparaciones: chartColor(1),
  accesorios: chartColor(2),
  otros: chartColor(3),
};
// orden de apilado, de abajo hacia arriba
const STACK: CatKey[] = ["equipos", "reparaciones", "accesorios", "otros"];

const MAX_BAR = 86; // alto de la barra más alta, en % de la banda
const BAR_W = 0.72; // ancho de barra como fracción de la columna

const total = (m: (typeof salesByMonth)[number]) =>
  m.equipos + m.reparaciones + m.accesorios + m.otros;

export function TendenciaRubros({ className }: { className?: string }) {
  const [hover, setHover] = useState<number | null>(null);

  const rows = salesByMonth;
  const n = rows.length;
  const totals = rows.map(total);
  const maxTotal = Math.max(...totals);
  const bh = (i: number) => (totals[i] / maxTotal) * MAX_BAR;
  const colW = 100 / n;

  const mom =
    n > 1 ? ((totals[n - 1] - totals[n - 2]) / totals[n - 2]) * 100 : 0;

  // geometría de segmentos en coords 0..100 (y=100 = base de las barras)
  const geom = rows.map((m, i) => {
    const t = totals[i];
    const h = bh(i);
    const xc = (i + 0.5) * colW;
    const half = (BAR_W * colW) / 2;
    let acc = 0;
    const segs = {} as Record<CatKey, { yTop: number; yBot: number }>;
    for (const k of STACK) {
      const yBot = 100 - (h * acc) / t;
      acc += m[k];
      const yTop = 100 - (h * acc) / t;
      segs[k] = { yTop, yBot };
    }
    return { left: xc - half, right: xc + half, segs };
  });

  // cintas entre barras consecutivas, una por rubro
  const ribbons: { d: string; k: CatKey; pair: number }[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = geom[i];
    const b = geom[i + 1];
    const dx = (b.left - a.right) * 0.5;
    for (const k of STACK) {
      const sa = a.segs[k];
      const sb = b.segs[k];
      ribbons.push({
        k,
        pair: i,
        d: [
          `M ${a.right} ${sa.yTop}`,
          `C ${a.right + dx} ${sa.yTop}, ${b.left - dx} ${sb.yTop}, ${b.left} ${sb.yTop}`,
          `L ${b.left} ${sb.yBot}`,
          `C ${b.left - dx} ${sb.yBot}, ${a.right + dx} ${sa.yBot}, ${a.right} ${sa.yBot}`,
          "Z",
        ].join(" "),
      });
    }
  }
  const ribbonOpacity = (pair: number) => {
    if (hover === null) return 0.17;
    return hover === pair || hover === pair + 1 ? 0.26 : 0.05;
  };

  return (
    <Card className={cn("flex flex-col p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <ChartTitle align="left">Tendencia por rubro</ChartTitle>
        <span
          className={cn(
            "shrink-0 rounded-md px-2 py-1 text-xs font-semibold",
            mom >= 0
              ? "bg-emerald-50 text-emerald-600"
              : "bg-red-50 text-red-600",
          )}
        >
          {mom >= 0 ? "+" : ""}
          {mom.toFixed(1).replace(".", ",")} %
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
        {CATS.map((c) => (
          <span key={c.key} className="inline-flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: c.color }}
            />
            {c.label}
          </span>
        ))}
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2">
        <div
          className="relative flex flex-1 items-end justify-between gap-3"
          onMouseLeave={() => setHover(null)}
        >
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {ribbons.map((r, idx) => (
              <path
                key={idx}
                d={r.d}
                fill={COLOR[r.k]}
                opacity={ribbonOpacity(r.pair)}
              />
            ))}
          </svg>

          {rows.map((m, i) => {
            const dim = hover !== null && hover !== i;
            return (
              <div
                key={m.mes}
                className="relative z-10 flex h-full flex-1 flex-col items-center justify-end"
                onMouseEnter={() => setHover(i)}
              >
                <span
                  className={cn(
                    "mb-1 text-[11px] font-semibold transition-opacity",
                    dim ? "text-neutral-300" : "text-neutral-500",
                  )}
                >
                  {m.mes}
                </span>
                <div
                  className={cn(
                    "flex w-[72%] flex-col gap-[3px] transition-opacity",
                    dim && "opacity-40",
                  )}
                  style={{ height: `${bh(i)}%` }}
                >
                  {[...STACK].reverse().map((k) => (
                    <div
                      key={k}
                      className="min-h-[4px] shrink-0 rounded-md"
                      style={{
                        flexGrow: m[k],
                        flexBasis: 0,
                        background: COLOR[k],
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {hover !== null && (
            <div
              className="pointer-events-none absolute top-0 z-20 -translate-x-1/2 rounded-lg bg-neutral-900 px-3 py-2 text-xs text-white shadow-lg"
              style={{ left: `${(hover + 0.5) * colW}%` }}
            >
              <p className="font-semibold">
                {rows[hover].mes} · {fmtUsd(totals[hover])}
              </p>
              {CATS.map((c) => (
                <p
                  key={c.key}
                  className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap"
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: c.color }}
                  />
                  {c.label} {fmtUsd(rows[hover][c.key])}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-between gap-3">
          {rows.map((m, i) => {
            const last = i === n - 1;
            const dim = hover !== null && hover !== i;
            return (
              <div key={m.mes} className="flex flex-1 justify-center">
                <span
                  className={cn(
                    "text-xs tabular-nums transition-opacity",
                    last
                      ? "rounded-md bg-neutral-900 px-2 py-1 font-semibold text-white"
                      : "text-neutral-500",
                    dim && "opacity-40",
                  )}
                >
                  {fmtUsd(totals[i])}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
