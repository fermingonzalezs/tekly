import { GraficoCard } from "@/components/ui/grafico-card";
import { chartColor } from "@/lib/chart";
import { TICKET_FLOW, ticketStatus } from "@/lib/status";
import type { Ticket } from "@/lib/types";

export function RepairsChart({ tickets }: { tickets: Ticket[] }) {
  const stages = TICKET_FLOW.map((s, i) => ({
    label: ticketStatus[s].label,
    count: tickets.filter((t) => t.estado === s).length,
    color: chartColor(i),
  }));
  const total = stages.reduce((a, s) => a + s.count, 0);
  const max = Math.max(1, ...stages.map((s) => s.count));

  return (
    <GraficoCard title="Reparaciones mes" sub={`${total} tickets en el taller`}>
      <div className="mt-1 flex flex-1 flex-col justify-between">
        {stages.map((s) => (
          <div key={s.label} className="flex items-center gap-3">
            <span className="w-24 shrink-0 truncate text-start text-[12px] text-neutral-600 sm:w-40">
              {s.label}
            </span>
            <div className="h-4 flex-1 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full w-full origin-left rounded-full transition-transform duration-300 ease-[cubic-bezier(0.77,0,0.175,1)]"
                style={{
                  transform: `scaleX(${s.count / max})`,
                  background: s.color,
                }}
              />
            </div>
            <span className="w-6 shrink-0 text-xs font-semibold tabular-nums">
              {s.count}
            </span>
          </div>
        ))}
      </div>
    </GraficoCard>
  );
}
