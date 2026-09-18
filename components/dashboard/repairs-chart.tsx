import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { GHOST_STRIPES, chartColor } from "@/lib/chart";
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
    <Card className="flex h-72 flex-col overflow-hidden p-5">
      <ChartTitle align="left" divider sub={`${total} tickets en el taller`}>
        Reparaciones mes
      </ChartTitle>

      <div className="mt-3 flex flex-1 flex-col justify-between">
        {stages.map((s) => (
          <div key={s.label} className="flex items-center gap-3">
            <span className="w-40 shrink-0 text-start text-[12px] text-neutral-600">
              {s.label}
            </span>
            <div
              className="h-4 flex-1 overflow-hidden rounded-full"
              style={{ background: GHOST_STRIPES }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(s.count / max) * 100}%`,
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
    </Card>
  );
}
