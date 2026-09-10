import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { chartColor } from "@/lib/chart";
import { ventas } from "@/lib/mock-data";

export function FuenteClientes() {
  const conteo = ventas.reduce<Record<string, number>>((a, v) => {
    const c = v.procedencia ?? "Sin dato";
    a[c] = (a[c] ?? 0) + 1;
    return a;
  }, {});
  const rows = Object.entries(conteo)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const menor = rows[rows.length - 1];

  return (
    <Card className="p-5">
      <ChartTitle align="left" divider>Fuente de clientes</ChartTitle>

      <div className="mt-6 flex gap-1.5">
        {rows.map((r, i) => (
          <div
            key={r.label}
            className="h-8 rounded-md"
            style={{ flexGrow: r.value, background: chartColor(i) }}
          />
        ))}
      </div>

      <div className="mt-2 flex gap-1">
        {rows.map((r, i) => (
          <div
            key={r.label}
            className="flex flex-col items-center"
            style={{ flexGrow: r.value, flexBasis: 0 }}
          >
            <span
              className="h-4 w-px opacity-60"
              style={{ background: chartColor(i) }}
            />
            <p className="mt-1 font-grotesk text-xl font-semibold tabular-nums">
              {r.value}
            </p>
            <p className="text-xs leading-tight text-neutral-400">
              {r.label}
            </p>
          </div>
        ))}
      </div>

      {menor && (
        <p className="mt-4 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
          De <span className="font-medium">{menor.label}</span> llegan las menos
          ventas — reforzá ese canal.
        </p>
      )}
    </Card>
  );
}
