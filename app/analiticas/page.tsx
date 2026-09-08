import { Section } from "@/components/section";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChartTitle } from "@/components/ui/chart-title";
import {
  margenPorTipo,
  tiempoPorFalla,
  rendimientoTecnicos,
  ventasPorMes,
  ventas,
  equipos,
  salesTrend,
} from "@/lib/mock-data";
import { equipoStatus, medioPago as medioPagoCfg } from "@/lib/status";
import { fmtUsd } from "@/lib/format";

type Row = { label: string; value: number };

function BarRows({ rows, fmt }: { rows: Row[]; fmt?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="mt-4 space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-neutral-600">{r.label}</span>
            <span className="font-semibold tabular-nums">
              {fmt ? fmt(r.value) : r.value}
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-neutral-100">
            <div
              className="h-2 rounded-full bg-accent"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function agrupar(
  pares: [string, number][],
): Row[] {
  return pares
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

export default function AnaliticasPage() {
  const maxMes = Math.max(...ventasPorMes.map((m) => m.usd));
  const maxHoras = Math.max(...tiempoPorFalla.map((f) => f.horas));

  const porVendedor = agrupar(
    Object.entries(
      ventas.reduce<Record<string, number>>((a, v) => {
        a[v.vendedor] = (a[v.vendedor] ?? 0) + v.totalUsd;
        return a;
      }, {}),
    ),
  );

  const porMedio = agrupar(
    Object.entries(
      ventas
        .flatMap((v) => v.pagos)
        .reduce<Record<string, number>>((a, p) => {
          a[p.medio] = (a[p.medio] ?? 0) + p.montoUsd;
          return a;
        }, {}),
    ),
  ).map((r) => ({
    ...r,
    label: medioPagoCfg[r.label as keyof typeof medioPagoCfg].label,
  }));

  const porCanal = agrupar(
    Object.entries(
      ventas.reduce<Record<string, number>>((a, v) => {
        const c = v.procedencia ?? "Sin dato";
        a[c] = (a[c] ?? 0) + v.totalUsd;
        return a;
      }, {}),
    ),
  );

  const equiposPorEstado = (
    Object.keys(equipoStatus) as (keyof typeof equipoStatus)[]
  ).map((s) => ({
    label: equipoStatus[s].label,
    value: equipos.filter((e) => e.estado === s).length,
  }));

  // facturación acumulada (14 días)
  const W = 640;
  const H = 160;
  let acc = 0;
  const acum = salesTrend.map((d) => (acc += d));
  const maxAcum = acum[acum.length - 1];
  const pts = acum.map((v, i) => {
    const x = (i / (acum.length - 1)) * W;
    const y = H - (v / maxAcum) * (H - 12);
    return `${x},${y}`;
  });
  const line = `M${pts.join(" L")}`;
  const area = `${line} L${W},${H} L0,${H} Z`;

  return (
    <Section title="Analíticas">
      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="p-5">
            <ChartTitle>Ventas por mes (U$)</ChartTitle>
            <div className="mt-5 flex items-end gap-3">
              {ventasPorMes.map((m) => (
                <div
                  key={m.mes}
                  className="flex flex-1 flex-col items-center gap-2"
                >
                  <span className="text-[11px] font-medium text-neutral-400">
                    {(m.usd / 1000).toFixed(0)}k
                  </span>
                  <div
                    className="w-full rounded-t-md bg-accent/80"
                    style={{ height: `${(m.usd / maxMes) * 140}px` }}
                  />
                  <span className="text-xs text-neutral-500">{m.mes}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <ChartTitle>Margen por tipo de operación</ChartTitle>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-xs text-neutral-400">
                  <th className="py-2 font-medium">Tipo</th>
                  <th className="py-2 font-medium">Ops.</th>
                  <th className="py-2 font-medium">Margen</th>
                  <th className="py-2 font-medium">Ganancia</th>
                </tr>
              </thead>
              <tbody>
                {margenPorTipo.map((r) => (
                  <tr key={r.tipo} className="border-t border-neutral-100">
                    <td className="py-2.5">{r.tipo}</td>
                    <td className="py-2.5 text-neutral-500">{r.operaciones}</td>
                    <td className="py-2.5">
                      <Badge tone={r.margenPct > 35 ? "green" : "blue"}>
                        {r.margenPct.toFixed(1)}%
                      </Badge>
                    </td>
                    <td className="py-2.5 font-semibold">
                      {fmtUsd(r.gananciaUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="p-5">
            <ChartTitle>Tiempo promedio por tipo de falla</ChartTitle>
            <ul className="mt-4 space-y-3">
              {tiempoPorFalla.map((f) => (
                <li key={f.falla}>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-neutral-600">{f.falla}</span>
                    <span className="font-semibold">
                      {f.horas} h
                      <span className="ml-1 text-xs font-normal text-neutral-400">
                        · {f.tickets} tickets
                      </span>
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-neutral-100">
                    <div
                      className="h-2 rounded-full bg-accent"
                      style={{ width: `${(f.horas / maxHoras) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5">
            <ChartTitle>Rendimiento por técnico</ChartTitle>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-xs text-neutral-400">
                  <th className="py-2 font-medium">Técnico</th>
                  <th className="py-2 font-medium">Cerrados</th>
                  <th className="py-2 font-medium">Reingresos</th>
                  <th className="py-2 font-medium">Prom.</th>
                  <th className="py-2 font-medium">Calif.</th>
                </tr>
              </thead>
              <tbody>
                {rendimientoTecnicos.map((t) => (
                  <tr key={t.tecnico} className="border-t border-neutral-100">
                    <td className="py-2.5 font-medium">{t.tecnico}</td>
                    <td className="py-2.5">{t.cerrados}</td>
                    <td className="py-2.5 text-neutral-500">{t.reingresos}</td>
                    <td className="py-2.5 text-neutral-500">
                      {t.ticketPromHoras} h
                    </td>
                    <td className="py-2.5 font-semibold">{t.calif} ★</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        {/* ── Nuevos ── */}
        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="p-5">
            <ChartTitle>Facturación por vendedor</ChartTitle>
            <BarRows rows={porVendedor} fmt={fmtUsd} />
          </Card>
          <Card className="p-5">
            <ChartTitle>Ingresos por medio de pago</ChartTitle>
            <BarRows rows={porMedio} fmt={fmtUsd} />
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="p-5">
            <ChartTitle>Ventas por canal</ChartTitle>
            <BarRows rows={porCanal} fmt={fmtUsd} />
          </Card>
          <Card className="p-5">
            <ChartTitle>Inventario · equipos por estado</ChartTitle>
            <BarRows rows={equiposPorEstado} />
          </Card>
        </div>

        <Card className="p-5">
          <ChartTitle sub="últimos 14 días">Facturación acumulada</ChartTitle>
          <div className="mt-4 flex items-end justify-between">
            <span className="text-2xl font-semibold tabular-nums">
              {fmtUsd(maxAcum)}
            </span>
          </div>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="mt-3 h-40 w-full"
          >
            <defs>
              <linearGradient id="acumFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#acumFill)" />
            <path
              d={line}
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </Card>
      </div>
    </Section>
  );
}
