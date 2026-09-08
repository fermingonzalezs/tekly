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
    <Card className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
        {label}
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <span className="text-3xl font-semibold leading-none tracking-tight tabular-nums">
          {value}
        </span>
        <span className="flex items-center gap-1.5">
          <Delta value={delta} />
          <span className="text-xs text-neutral-400">vs mes previo</span>
        </span>
      </div>
    </Card>
  );
}

export function MetricCards() {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
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
