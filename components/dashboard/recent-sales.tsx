"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { recentSales } from "@/lib/mock-data";
import { fmtUsd } from "@/lib/format";

const CATEGORIAS = ["Todas", ...Array.from(new Set(recentSales.map((s) => s.categoria)))];

export function RecentSales({ className }: { className?: string }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Todas");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return recentSales.filter((s) => {
      if (cat !== "Todas" && s.categoria !== cat) return false;
      if (!needle) return true;
      return [s.id, s.cliente, s.item, s.vendedor]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [q, cat]);

  return (
    <Card className={cn("flex min-h-0 flex-col overflow-hidden", className)}>
      <div className="shrink-0 px-4 pt-4">
        <div className="flex flex-wrap items-start gap-2">
          <div className="mr-auto min-w-0">
            <ChartTitle align="left" sub="Seguimiento de las últimas ventas">
              Ventas recientes
            </ChartTitle>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar…"
                className="h-8 w-36 pl-8 text-[13px]"
              />
            </div>

            <Select
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              className="h-8 w-44 text-[13px]"
            >
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c === "Todas" ? "Todas las categorías" : c}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="mt-3 border-t border-neutral-100" />
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-auto">
        <table className="w-full text-[13px]">
          <tbody>
            {filtered.slice(0, 6).map((s) => (
              <tr
                key={s.id}
                className="border-t border-neutral-100 last:border-b-0"
              >
                <td className="px-4 py-3 text-start font-medium text-neutral-500">
                  {s.id}
                </td>
                <td className="px-4 py-3 text-start">{s.cliente}</td>
                <td className="px-4 py-3 text-start text-neutral-500">
                  {s.item}
                </td>
                <td className="px-4 py-3 font-semibold">
                  <span className="block text-right tabular-nums">
                    {fmtUsd(s.monto)}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr className="border-t border-neutral-100">
                <td
                  colSpan={4}
                  className="px-4 py-6 text-center text-[13px] text-neutral-400"
                >
                  Sin resultados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
