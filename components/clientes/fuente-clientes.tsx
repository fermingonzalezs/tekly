import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { chartColor, GHOST_STRIPES } from "@/lib/chart";
import { procedenciaCounts } from "@/lib/db/ventas";

export async function FuenteClientes() {
  const rows = await procedenciaCounts();
  const menor = rows[rows.length - 1];

  return (
    <Card className="flex h-auto min-w-0 flex-col p-5 sm:h-72">
      <ChartTitle align="left" divider>Fuente de clientes</ChartTitle>

      <div className="flex flex-1 flex-col justify-center">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-400">
            Todavía no hay ventas registradas.
          </p>
        ) : (
          <>
            <div
              className="flex gap-[3px] overflow-hidden rounded-full"
              style={{ background: GHOST_STRIPES }}
            >
              {rows.map((r, i) => (
                <div
                  key={r.label}
                  className="h-6"
                  style={{ flexGrow: r.value, background: chartColor(i) }}
                />
              ))}
            </div>

            <div className="mt-2 flex gap-1">
              {rows.map((r, i) => (
                <div
                  key={r.label}
                  className="flex min-w-0 flex-col items-center"
                  style={{ flexGrow: r.value, flexBasis: 0 }}
                >
                  <span
                    className="h-4 w-px opacity-60"
                    style={{ background: chartColor(i) }}
                  />
                  <p className="mt-1 font-grotesk text-xl font-semibold tabular-nums">
                    {r.value}
                  </p>
                  <p className="w-full truncate text-center text-xs leading-tight text-neutral-400">
                    {r.label}
                  </p>
                </div>
              ))}
            </div>

            {menor && (
              <p className="mt-4 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
                De <span className="font-medium">{menor.label}</span> llegan las
                menos ventas — reforzá ese canal.
              </p>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
