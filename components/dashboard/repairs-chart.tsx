import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { ticketStages } from "@/lib/mock-data";

export function RepairsChart() {
  const total = ticketStages.reduce((a, s) => a + s.count, 0);
  const max = Math.max(...ticketStages.map((s) => s.count));

  return (
    <Card className="p-5">
      <ChartTitle sub={`${total} tickets en el taller`}>
        Reparaciones mes
      </ChartTitle>

      <div className="mt-5 space-y-3">
        {ticketStages.map((s) => (
          <div key={s.label} className="flex items-center gap-3">
            <span className="w-40 shrink-0 text-start text-[13px] text-neutral-600">
              {s.label}
            </span>
            <div className="h-6 flex-1 overflow-hidden rounded-md bg-neutral-100">
              <div
                className="h-full rounded-md"
                style={{
                  width: `${(s.count / max) * 100}%`,
                  background: s.color,
                }}
              />
            </div>
            <span className="w-6 shrink-0 text-sm font-semibold tabular-nums">
              {s.count}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
