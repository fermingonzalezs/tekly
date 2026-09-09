"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/card";
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
      <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 pt-4">
        <div className="mr-auto">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Ventas recientes
          </p>
          <p className="text-[11px] text-neutral-400">
            Seguimiento de las últimas ventas
          </p>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar…"
            className="h-8 w-40 pl-8 text-[13px]"
          />
        </div>

        <Select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className="h-8 w-36 text-[13px]"
        >
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {c === "Todas" ? "Todas las categorías" : c}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-2 min-h-0 flex-1 overflow-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-xs text-neutral-400">
              <th className="px-4 py-1.5 font-medium">Venta</th>
              <th className="px-4 py-1.5 font-medium">Cliente</th>
              <th className="px-4 py-1.5 font-medium">Ítem</th>
              <th className="px-4 py-1.5 font-medium">Vendedor</th>
              <th className="px-4 py-1.5 font-medium">Monto</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr
                key={s.id}
                className="border-t border-neutral-100 last:border-b-0"
              >
                <td className="px-4 py-3 font-medium text-neutral-500">
                  {s.id}
                </td>
                <td className="px-4 py-3">{s.cliente}</td>
                <td className="px-4 py-3 text-neutral-500">{s.item}</td>
                <td className="px-4 py-3">{s.vendedor}</td>
                <td className="px-4 py-3 font-semibold">{fmtUsd(s.monto)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr className="border-t border-neutral-100">
                <td
                  colSpan={5}
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
