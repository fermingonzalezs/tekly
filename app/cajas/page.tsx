"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Lock } from "lucide-react";
import { Section } from "@/components/section";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { medioPago as medioPagoCfg } from "@/lib/status";
import {
  movimientosHoy,
  movimientosTodos,
  cierresPrevios,
} from "@/lib/mock-data";
import { fmtUsd, fmtArs } from "@/lib/format";
import { useDolar } from "@/lib/dolar";
import { cn } from "@/lib/utils";
import type { MedioPago, MovimientoCaja } from "@/lib/types";

const MEDIOS: MedioPago[] = [
  "pesos",
  "dolares",
  "transferencia",
  "cripto",
  "tarjeta",
  "canje",
];

const HEAD = "text-[11px] font-semibold uppercase tracking-wider text-neutral-400";

const signo = (m: MovimientoCaja) => (m.tipo === "ingreso" ? m.monto : -m.monto);
const money = (moneda: MovimientoCaja["moneda"], n: number) =>
  moneda === "usd" ? fmtUsd(n) : fmtArs(n);

export default function CajasPage() {
  const [cerrada, setCerrada] = useState(false);
  const [vista, setVista] = useState<"dia" | "historial">("dia");
  const RATE = useDolar().venta;

  const enArs = (m: MovimientoCaja) =>
    m.moneda === "ars" ? m.monto : m.monto * RATE;

  const netoUsd = movimientosHoy
    .filter((m) => m.moneda === "usd")
    .reduce((a, m) => a + signo(m), 0);
  const netoArs = movimientosHoy
    .filter((m) => m.moneda === "ars")
    .reduce((a, m) => a + signo(m), 0);
  const totalArs = netoArs + netoUsd * RATE;

  // Por medio de pago — consolidado en ARS.
  const porMedio = MEDIOS.map((medio) => ({
    medio,
    total: movimientosHoy
      .filter((x) => x.medioPago === medio)
      .reduce((a, x) => a + (x.tipo === "ingreso" ? enArs(x) : -enArs(x)), 0),
  })).filter((p) => p.total !== 0);

  const movs = vista === "dia" ? movimientosHoy : movimientosTodos;

  return (
    <Section title="Cajas">
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button
            variant={cerrada ? "outline" : "primary"}
            onClick={() => setCerrada((v) => !v)}
          >
            <Lock className="h-4 w-4" />
            {cerrada ? "Reabrir caja" : "Cerrar caja del día"}
          </Button>
        </div>

        {cerrada && (
          <div className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
            Caja cerrada · total {fmtArs(totalArs)} · responsable Fermín G.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Caja USD"
            value={fmtUsd(netoUsd)}
            hint="neto del día"
            valueClassName={netoUsd < 0 ? "text-red-500" : undefined}
          />
          <StatCard
            label="Caja ARS"
            value={fmtArs(netoArs)}
            hint="neto del día"
            valueClassName={netoArs < 0 ? "text-red-500" : undefined}
          />
          <StatCard
            label="Total (ARS)"
            value={fmtArs(totalArs)}
            hint={`consolidado al dólar ${fmtArs(RATE)}`}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5">
              <p className={HEAD}>
                {vista === "dia"
                  ? "Movimientos del día"
                  : "Historial de movimientos"}
              </p>
              <div className="flex rounded-lg border border-neutral-200 p-0.5">
                {(
                  [
                    ["dia", "Del día"],
                    ["historial", "Historial"],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setVista(v)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors",
                      vista === v
                        ? "bg-accent-soft text-accent"
                        : "text-neutral-400 hover:text-neutral-600",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-xs text-neutral-400">
                  {vista === "historial" && <th className="px-5 py-2">Fecha</th>}
                  <th className="px-5 py-2">Hora</th>
                  <th className="px-5 py-2">Concepto</th>
                  <th className="px-5 py-2">Caja</th>
                  <th className="px-5 py-2">Medio</th>
                  <th className="px-5 py-2">Monto</th>
                </tr>
              </thead>
              <tbody>
                {movs.map((m) => (
                  <tr
                    key={m.id}
                    className="border-t border-neutral-100 first:border-t-0"
                  >
                    {vista === "historial" && (
                      <td className="px-5 py-3 text-neutral-400">{m.fecha}</td>
                    )}
                    <td className="px-5 py-3 text-neutral-400">{m.hora}</td>
                    <td className="px-5 py-3 text-start">
                      <span className="inline-flex items-center gap-2">
                        {m.tipo === "ingreso" ? (
                          <ArrowDownLeft className="h-4 w-4 shrink-0 text-emerald-500" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4 shrink-0 text-red-400" />
                        )}
                        {m.concepto}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={m.moneda === "usd" ? "blue" : "green"}>
                        {m.moneda.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={medioPagoCfg[m.medioPago].tone}>
                        {medioPagoCfg[m.medioPago].label}
                      </Badge>
                    </td>
                    <td
                      className={cn(
                        "px-5 py-3 font-semibold tabular-nums",
                        m.tipo === "ingreso"
                          ? "text-emerald-600"
                          : "text-red-500",
                      )}
                    >
                      {m.tipo === "ingreso" ? "+" : "−"}
                      {money(m.moneda, m.monto)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <div className="space-y-6">
            <Card className="p-5">
              <p className={HEAD}>Por medio de pago (ARS)</p>
              <ul className="mt-3 space-y-2 text-sm">
                {porMedio.length === 0 && (
                  <li className="text-neutral-400">Sin movimientos hoy.</li>
                )}
                {porMedio.map((p) => (
                  <li
                    key={p.medio}
                    className="flex items-center justify-between"
                  >
                    <span className="text-neutral-600">
                      {medioPagoCfg[p.medio].label}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {fmtArs(p.total)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-5">
              <p className={HEAD}>Cierres previos (USD)</p>
              <ul className="mt-3 space-y-3 text-sm">
                {cierresPrevios.map((c) => (
                  <li key={c.fecha}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{c.fecha}</span>
                      <span className="font-semibold">{fmtUsd(c.neto)}</span>
                    </div>
                    <p className="text-xs text-neutral-400">
                      +{fmtUsd(c.ingresos)} / −{fmtUsd(c.egresos)} · {c.responsable}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </Section>
  );
}
