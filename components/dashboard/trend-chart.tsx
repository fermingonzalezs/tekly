"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { salesDaily } from "@/lib/mock-data";
import { fmtUsd } from "@/lib/format";

const VB_W = 720;
const VB_H = 200;
const TOP = 10;
const BOT = 2;

export function TrendChart() {
  const [hover, setHover] = useState<number | null>(null);

  const rows = salesDaily;
  const n = rows.length;
  const totals = rows.map((d) => d.ventas + d.reparaciones);
  const total = totals.reduce((a, b) => a + b, 0);
  const gananciaTotal = rows.reduce((a, d) => a + d.ganancia, 0);
  const max = Math.max(...totals);

  const slot = VB_W / n;
  const baseW = slot * 0.62;
  const y = (v: number) => VB_H - BOT - (v / max) * (VB_H - BOT - TOP);
  const cx = (i: number) => i * slot + slot / 2;

  const linePts = rows.map((d, i) => `${cx(i)},${y(d.ganancia)}`).join(" ");
  const hd = hover !== null ? rows[hover] : null;
  const tipLeft =
    hover === null ? 50 : Math.min(86, Math.max(14, (cx(hover) / VB_W) * 100));

  return (
    <Card className="p-5">
      <ChartTitle align="left">Tendencia de ventas</ChartTitle>
      <div className="mt-3 flex items-start justify-between">
        <div>
          <p className="text-3xl font-semibold tracking-tight tabular-nums">
            {fmtUsd(total)}
          </p>
          <p className="text-xs text-neutral-400">
            14 días · ganancia {fmtUsd(gananciaTotal)}
          </p>
        </div>
        <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-600">
          +18,3 %
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[3px] bg-accent" /> Ventas
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[3px] bg-violet-400" /> Reparaciones
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-3.5 rounded bg-amber-500" /> Ganancia
        </span>
      </div>

      <div className="relative mt-3">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="w-full"
          onMouseLeave={() => setHover(null)}
        >
          {rows.map((d, i) => {
            const t = d.ventas + d.reparaciones;
            const isH = hover === i;
            const dim = hover !== null && !isH;
            const w = isH ? baseW * 1.28 : baseW;
            const x = cx(i) - w / 2;
            const yTop = y(t);
            const ySplit = y(d.ventas);
            const vPct = Math.round((d.ventas / t) * 100);
            return (
              <g
                key={i}
                className="cursor-pointer"
                onMouseEnter={() => setHover(i)}
              >
                <rect
                  x={i * slot}
                  y={0}
                  width={slot}
                  height={VB_H}
                  fill="transparent"
                />
                {isH && (
                  <rect
                    x={i * slot}
                    y={0}
                    width={slot}
                    height={VB_H}
                    fill="#2563eb"
                    opacity="0.035"
                  />
                )}
                <rect
                  className="transition-all duration-150"
                  x={x}
                  y={ySplit}
                  width={w}
                  height={VB_H - BOT - ySplit}
                  rx="4"
                  fill="#2563eb"
                  opacity={dim ? 0.55 : 1}
                />
                <rect
                  className="transition-all duration-150"
                  x={x}
                  y={yTop}
                  width={w}
                  height={Math.max(0, ySplit - yTop)}
                  rx="4"
                  fill="#a78bfa"
                  opacity={dim ? 0.55 : 1}
                />
                {isH && (
                  <>
                    <text
                      x={cx(i)}
                      y={(ySplit + (VB_H - BOT)) / 2 + 4}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="700"
                      fill="#fff"
                    >
                      {vPct}%
                    </text>
                    {ySplit - yTop > 18 && (
                      <text
                        x={cx(i)}
                        y={(yTop + ySplit) / 2 + 4}
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="700"
                        fill="#fff"
                      >
                        {100 - vPct}%
                      </text>
                    )}
                  </>
                )}
              </g>
            );
          })}

          <polyline
            points={linePts}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={hover === null ? 1 : 0.6}
          />
          {rows.map((d, i) => (
            <circle
              key={i}
              className="transition-all duration-150"
              cx={cx(i)}
              cy={y(d.ganancia)}
              r={hover === i ? 4.5 : 3.5}
              fill="#fff"
              stroke="#f59e0b"
              strokeWidth="2"
              opacity={hover === null || hover === i ? 1 : 0.6}
            />
          ))}
        </svg>

        {hd && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg bg-neutral-900 px-3 py-2 text-xs leading-relaxed text-white shadow-lg"
            style={{ left: `${tipLeft}%` }}
          >
            <p className="font-semibold">
              {hover === n - 1 ? "Hoy" : `Hace ${n - 1 - (hover ?? 0)} días`}
            </p>
            <p className="mt-1 flex items-center gap-1.5 whitespace-nowrap">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
              Ventas {fmtUsd(hd.ventas)}
            </p>
            <p className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
              Reparac. {fmtUsd(hd.reparaciones)}
            </p>
            <p className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Ganancia {fmtUsd(hd.ganancia)}
            </p>
          </div>
        )}
      </div>

      <div className="mt-1.5 flex justify-between text-xs text-neutral-400">
        <span>hace 14 días</span>
        <span>hoy</span>
      </div>
    </Card>
  );
}
