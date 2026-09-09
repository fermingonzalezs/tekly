import { Card } from "@/components/ui/card";
import { Delta } from "@/components/ui/stat-card";
import { dashboardMetrics } from "@/lib/mock-data";

function MetricCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta: number;
}) {
  return (
    <Card className="p-3">
      <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
        {label}
      </p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <span className="text-xl font-semibold leading-none tracking-tight tabular-nums">
          {value}
        </span>
        <Delta value={delta} />
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
        />
      ))}
    </div>
  );
}
