import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { ventas } from "@/lib/mock-data";

const GRAD = [
  "from-rose-200 to-rose-300",
  "from-teal-200 to-teal-300",
  "from-violet-200 to-violet-300",
  "from-amber-200 to-amber-300",
  "from-sky-200 to-sky-300",
];
const DOT = [
  "bg-rose-400",
  "bg-teal-400",
  "bg-violet-400",
  "bg-amber-400",
  "bg-sky-400",
];

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
      <ChartTitle align="left">Fuente de clientes</ChartTitle>

      <div className="mt-6 flex gap-1.5">
        {rows.map((r, i) => (
          <div
            key={r.label}
            className={`h-8 rounded-lg bg-gradient-to-r ${GRAD[i % GRAD.length]}`}
            style={{ flexGrow: r.value }}
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
              className={`h-4 w-px opacity-50 ${DOT[i % DOT.length]}`}
            />
            <p className="mt-1 text-xl font-semibold tabular-nums">{r.value}</p>
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
