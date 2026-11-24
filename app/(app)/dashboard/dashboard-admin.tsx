"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Section } from "@/components/section";
import { Card } from "@/components/ui/card";
import { IconButton } from "@/components/ui/button";
import { KpisAdmin } from "@/components/dashboard/kpis-admin";
import { AgendaLocalCard } from "@/components/dashboard/agenda-local";
import { RitmoChart } from "@/components/dashboard/ritmo-chart";
import { RubrosPie } from "@/components/dashboard/rubros-pie";
import { ObjetivoMes as ObjetivoMesCard } from "@/components/dashboard/objetivo-mes";
import { VentasRecientesTabla } from "@/components/dashboard/ventas-recientes-tabla";
import { useRefrescoEnVivo } from "@/components/dashboard/use-refresco-en-vivo";
import {
  etiquetaMes,
  moverMes,
  type AgendaLocal,
  type MesDashboard,
  type MetricaDashboard,
  type ObjetivoMes,
  type RitmoMes,
  type VentaReciente,
} from "@/lib/dashboard";

/** KPIs que muestra la fila de arriba (tickets abiertos / turnos hoy pasaron
 * a los contadores de "Agenda del local"). */
const KPIS = ["ventas", "ganancia", "margen", "ticket"];

/** Dashboard de admin, de arriba abajo: 4 KPIs ("Ventas del mes"
 * destacada), agenda del local (tickets listos + próximos turnos), objetivo
 * del mes, ritmo del mes + vendido por rubro y ventas recientes en tabla. La
 * página scrollea. Se actualiza sola ante eventos de la org
 * (`useRefrescoEnVivo`). */
export function DashboardAdmin({
  metrics,
  objetivo,
  objetivoTarget,
  ritmo,
  rubros,
  mes,
  onMesChange,
  recentSales,
  agenda,
  ventasHref,
  demo = false,
}: {
  metrics: MetricaDashboard[];
  objetivo: ObjetivoMes;
  objetivoTarget: number;
  ritmo: RitmoMes;
  rubros: { label: string; value: number }[];
  mes: MesDashboard;
  /** Cambio de mes. Sin esto navega con `?mes=YYYY-MM` (la app real); la
   * demo lo pasa para llevar el mes en estado local. */
  onMesChange?: (clave: string) => void;
  recentSales: VentaReciente[];
  agenda: AgendaLocal;
  /** Base del link de "Ventas recientes" (en demo `/demo/ventas`). */
  ventasHref?: string;
  /** Demo sin cuenta: sin links a secciones que no existen ahí. */
  demo?: boolean;
}) {
  useRefrescoEnVivo();
  const router = useRouter();
  const pathname = usePathname();
  const [pendiente, startTransition] = useTransition();
  const irA = (clave: string) => {
    if (onMesChange) return onMesChange(clave);
    startTransition(() => router.replace(`${pathname}?mes=${clave}`, { scroll: false }));
  };

  return (
    <Section
      title="Dashboard"
      ayuda="dashboard"
      toolbar={
        <div className="flex items-center gap-1 rounded-full border border-neutral-900/10 bg-white px-1 shadow-sm">
          <IconButton
            aria-label="Mes anterior"
            icon={ChevronLeft}
            variant="ghost"
            size="sm"
            onClick={() => irA(moverMes(mes.clave, -1))}
          />
          <span className="min-w-[8.5rem] text-center text-sm font-medium tabular-nums">
            {etiquetaMes(mes.anio, mes.mes0)}
          </span>
          <IconButton
            aria-label="Mes siguiente"
            icon={ChevronRight}
            variant="ghost"
            size="sm"
            disabled={mes.esActual}
            onClick={() => irA(moverMes(mes.clave, 1))}
          />
        </div>
      }
    >
      <div className={`mx-auto max-w-[1400px] space-y-4 transition-opacity ${pendiente ? "opacity-60" : ""}`}>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-lg font-semibold text-neutral-900">
            Resumen de {etiquetaMes(mes.anio, mes.mes0).toLowerCase()}
          </h1>
          {mes.esActual && (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-neutral-500">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#12a383]" aria-hidden="true" />
              actualizado en vivo
            </span>
          )}
        </div>

        <KpisAdmin metrics={metrics.filter((m) => KPIS.includes(m.key))} />

        <AgendaLocalCard agenda={agenda} enlaces={!demo} />

        <ObjetivoMesCard
          current={objetivo.current}
          dayOfMonth={objetivo.dayOfMonth}
          daysInMonth={objetivo.daysInMonth}
          target={objetivoTarget}
          esActual={mes.esActual}
          configurarHref={demo ? null : "/configuracion?tab=negocio"}
        />

        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <RitmoChart className="min-h-[340px] min-w-0" ritmo={ritmo} target={objetivoTarget} />
          <Card className="flex min-w-0 flex-col p-5">
            <RubrosPie data={rubros} totalFacturado={objetivo.current} />
          </Card>
        </div>

        <VentasRecientesTabla sales={recentSales} ventasHref={ventasHref} />
      </div>
    </Section>
  );
}
