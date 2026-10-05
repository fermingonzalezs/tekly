"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Section } from "@/components/section";
import { Tabs } from "@/components/ui/tabs";
import { Input, Select } from "@/components/ui/field";
import { DATE_PRESETS, contextoPeriodo, type DatePreset } from "@/lib/date-presets";
import { filterPill } from "@/lib/ui-styles";
import {
  TABS_ANALITICAS,
  queryDeAnaliticas,
  type FiltrosAnaliticas,
  type TabAnaliticas,
} from "@/lib/analiticas-filtros";
import type { Rango } from "@/lib/date-presets";
import { cn } from "@/lib/utils";
import { VentasTab } from "./tabs/ventas-tab";
import { ReparacionesTab } from "./tabs/reparaciones-tab";
import { FinanzasTab } from "./tabs/finanzas-tab";
import { InventarioTab } from "./tabs/inventario-tab";
import { ClientesTab } from "./tabs/clientes-tab";
import { TurnosTab } from "./tabs/turnos-tab";
import type {
  ResumenClientes,
  ResumenFinanzas,
  ResumenInventario,
  ResumenReparaciones,
  ResumenTurnos,
  ResumenVentasAnaliticas,
} from "@/lib/analiticas-resumen";
import type { AntiguedadTickets } from "@/lib/analiticas";

/** Shell de Analíticas: tab + período viven en la URL (fuente de verdad);
 * cada pestaña recibe su resumen ya calculado en el server. La transición
 * baja el contenido a `opacity-60` mientras carga (mismo patrón que Ventas,
 * ver plan 007). */
export function AnaliticasClient({
  filtros,
  rango,
  rangoAnterior,
  ventas,
  reparaciones,
  finanzas,
  inventario,
  clientes,
  turnos,
  antiguedadTickets,
}: {
  filtros: FiltrosAnaliticas;
  rango: Rango;
  rangoAnterior: Rango | null;
  ventas: ResumenVentasAnaliticas | null;
  reparaciones: ResumenReparaciones | null;
  finanzas: ResumenFinanzas | null;
  inventario: ResumenInventario | null;
  clientes: ResumenClientes | null;
  turnos: ResumenTurnos | null;
  antiguedadTickets: AntiguedadTickets[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function navegar(next: FiltrosAnaliticas) {
    const qs = queryDeAnaliticas(next);
    startTransition(() => {
      router.replace(qs ? `/analiticas?${qs}` : "/analiticas", { scroll: false });
    });
  }

  const periodoDeshabilitado = filtros.tab === "inventario";

  return (
    <Section title="Analíticas" ayuda="analiticas">
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Select
            value={filtros.preset}
            onChange={(e) => {
              const preset = e.target.value as DatePreset;
              navegar({ ...filtros, preset, desde: "", hasta: "" });
            }}
            disabled={periodoDeshabilitado}
            title={
              periodoDeshabilitado
                ? "El stock es una foto del estado actual; solo el flujo de inventario respeta el período"
                : undefined
            }
            className={cn("w-full sm:w-44", filterPill, periodoDeshabilitado && "opacity-60")}
            aria-label="Período"
          >
            {DATE_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
          {filtros.preset === "personalizado" && !periodoDeshabilitado && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={filtros.desde}
                onChange={(e) => navegar({ ...filtros, desde: e.target.value })}
                className={cn("w-full sm:w-36", filterPill)}
                aria-label="Desde"
              />
              <span className="text-xs text-neutral-500">a</span>
              <Input
                type="date"
                value={filtros.hasta}
                onChange={(e) => navegar({ ...filtros, hasta: e.target.value })}
                className={cn("w-full sm:w-36", filterPill)}
                aria-label="Hasta"
              />
            </div>
          )}
          <p className="text-xs text-neutral-500">
            {contextoPeriodo(filtros.preset, rango)}
            {rangoAnterior && filtros.preset !== "todos"
              ? ` · vs ${contextoPeriodo(filtros.preset, rangoAnterior).toLowerCase()}`
              : ""}
          </p>
        </div>

        <Tabs
          value={filtros.tab}
          onChange={(tab) => navegar({ ...filtros, tab })}
          options={TABS_ANALITICAS.map((c) => ({ value: c.value, label: c.label }))}
        />

        <div className={cn(isPending && "opacity-60")}>
          {filtros.tab === "ventas" && ventas && <VentasTab resumen={ventas} />}
          {filtros.tab === "reparaciones" && reparaciones && (
            <ReparacionesTab resumen={reparaciones} antiguedad={antiguedadTickets} />
          )}
          {filtros.tab === "finanzas" && finanzas && <FinanzasTab resumen={finanzas} />}
          {filtros.tab === "inventario" && inventario && <InventarioTab resumen={inventario} />}
          {filtros.tab === "clientes" && clientes && <ClientesTab resumen={clientes} />}
          {filtros.tab === "turnos" && turnos && <TurnosTab resumen={turnos} />}
        </div>
      </div>
    </Section>
  );
}
