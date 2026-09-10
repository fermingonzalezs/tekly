import { Card } from "@/components/ui/card";
import { Delta } from "@/components/ui/stat-card";
import { dashboardMetrics } from "@/lib/mock-data";

function MetricCard({
  label,
  value,
  delta,
  deltaHint,
}: {
  label: string;
  value: string;
  delta: number;
  deltaHint: string;
}) {
  return (
    <Card className="p-3">
      <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
        {label}
      </p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <span className="font-grotesk text-3xl font-semibold leading-none tracking-tight tabular-nums">
          {value}
        </span>
        <div className="flex shrink-0 flex-col items-end gap-1 leading-none">
          <Delta value={delta} className="px-1.5 py-0.5 text-[10px]" />
          <span className="whitespace-nowrap text-[10px] text-neutral-400">
            {deltaHint}
          </span>
        </div>
      </div>
    </Card>
  );
}

export function MetricCards() {
  return (
    <div className="grid shrink-0 grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
      {dashboardMetrics.map((m) => (
        <MetricCard
          key={m.key}
          label={m.label}
          value={m.value}
          delta={m.delta}
          deltaHint={m.deltaHint}
        />
      ))}
    </div>
  );
}
