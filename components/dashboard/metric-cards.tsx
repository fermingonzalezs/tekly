import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { dashboardMetrics, usdArs } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

function Delta({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-semibold",
        up ? "text-emerald-600" : "text-red-500",
      )}
    >
      {up ? (
        <ArrowUpRight className="h-3.5 w-3.5" />
      ) : (
        <ArrowDownRight className="h-3.5 w-3.5" />
      )}
      {Math.abs(value).toFixed(1)} %
    </span>
  );
}

export function MetricCards() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
      {dashboardMetrics.map((m) => (
        <Card key={m.key} className="p-4">
          <p className="text-xs font-medium text-neutral-400">{m.label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{m.value}</p>
          <div className="mt-1.5">
            <Delta value={m.delta} />
            <span className="ml-1 text-xs text-neutral-400">vs mes previo</span>
          </div>
        </Card>
      ))}
      <Card className="p-4">
        <p className="text-xs font-medium text-neutral-400">{usdArs.label}</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight">
          $ {usdArs.value.toLocaleString("es-AR")}
        </p>
        <div className="mt-1.5">
          <Delta value={usdArs.delta} />
          <span className="ml-1 text-xs text-neutral-400">hoy</span>
        </div>
      </Card>
    </div>
  );
}
