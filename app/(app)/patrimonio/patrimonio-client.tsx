"use client";

import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { StatCard } from "@/components/ui/stat-card";
import { ButtonLink } from "@/components/ui/button";
import { GraficoDona, GraficoRanking } from "@/components/seccion/graficos";
import { fmtArs, fmtDateSlash, fmtUsd } from "@/lib/format";
import { EvolucionPatrimonio } from "@/components/patrimonio/evolucion-chart";
import type { Patrimonio, PatrimonioCategoria } from "@/lib/patrimonio";
import type { PuntoMensual, VariacionPatrimonio } from "@/lib/patrimonio-historial";

type DolarProp = {
  venta: number;
  fuente: "api" | "fallback";
  actualizado?: string;
};

export function PatrimonioClient({
  patrimonio: p,
  dolar,
  hoyIso,
  historial,
  variacion,
  desdeFoto,
}: {
  patrimonio: Patrimonio;
  dolar: DolarProp;
  hoyIso: string;
  historial: PuntoMensual[];
  /** Variación % contra el cierre del mes anterior; `null` si todavía no hay
   *  foto de ese mes (el historial recién empieza). */
  variacion: VariacionPatrimonio | null;
  desdeFoto: string | null;
}) {
  const deltaHint = variacion ? `vs ${variacion.contraMes}` : undefined;
  const liquidez =
    p.activo.total > 0
      ? (p.activo.disponibilidades.total / p.activo.total) * 100
      : null;

  const composicion = [
    { label: "Disponibilidades", value: p.activo.disponibilidades.total },
    { label: "Créditos", value: p.activo.creditos.total },
    { label: "Inventario", value: p.activo.inventario.total },
    { label: "Anticipos", value: p.activo.anticipos.total },
  ].filter((d) => d.value > 0);

  const inventarioRows = p.activo.inventario.porCategoria
    .filter((c) => c.valor > 0 || c.unidades > 0)
    .map((c) => ({ label: c.label, value: c.valor }));

  const sinCosto = p.activo.inventario.porCategoria.reduce((a, c) => a + c.sinCosto, 0);

  return (
    <div className="space-y-6">
      {/* Cabecera: valuación, cotización y aviso de balance gerencial */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm">
        <p className="text-neutral-600">
          Valuación al{" "}
          <span className="font-medium text-neutral-900">{fmtDateSlash(hoyIso)}</span>
          <span className="text-neutral-400"> · balance gerencial, no reemplaza al de tu contador</span>
        </p>
        <p className="text-neutral-500">
          Cotización blue{" "}
          {dolar.fuente === "fallback" && <span className="text-amber-600">(referencia)</span>}:{" "}
          <span className="font-semibold tabular-nums text-neutral-900">
            {fmtArs(dolar.venta)}
          </span>
          {dolar.actualizado ? (
            <span className="text-neutral-400"> · actualizada {dolar.actualizado.slice(11, 16)}</span>
          ) : null}
        </p>
      </div>

      {!p.cotizacionValida && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-neutral-700">
          No hay cotización válida: las cajas en pesos se muestran <strong>sin convertir</strong> a
          dólares.
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Patrimonio neto"
          value={fmtUsd(p.patrimonioNeto)}
          {...(variacion?.patrimonio != null
            ? { delta: variacion.patrimonio, deltaHint }
            : { hint: "activo − pasivo" })}
          valueClassName={p.patrimonioNeto < 0 ? "text-red-500" : undefined}
        />
        <StatCard
          label="Activo total"
          value={fmtUsd(p.activo.total)}
          {...(variacion?.activo != null
            ? { delta: variacion.activo, deltaHint }
            : { hint: "lo que el negocio tiene" })}
        />
        {/* Sin delta en el pasivo: `Delta` pinta de verde lo que sube, y un
            pasivo que crece no es una buena noticia. */}
        <StatCard
          label="Pasivo total"
          value={fmtUsd(p.pasivo.total)}
          hint="saldos a favor de clientes"
        />
        <StatCard
          label="Liquidez"
          value={liquidez === null ? "—" : `${liquidez.toFixed(0)}%`}
          hint={
            liquidez === null
              ? "sin activo"
              : `de cada U$ 100 de activo, U$ ${liquidez.toFixed(0)} en caja`
          }
        />
      </div>

      {/* Evolución (fase 2): una foto por día, un punto por mes */}
      <EvolucionPatrimonio puntos={historial} desdeFoto={desdeFoto} />

      {/* Gráficos */}
      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <GraficoDona
          title="Composición del activo"
          sub={`Total ${fmtUsd(p.activo.total)}`}
          data={composicion}
          fmtValor={fmtUsd}
          vacio="Todavía no hay activo que mostrar."
        />
        <GraficoRanking
          title="Inventario por categoría"
          sub="valor a costo"
          rows={inventarioRows}
          fmt={fmtUsd}
          vacio="Sin stock cargado."
        />
      </div>

      {/* Disponibilidades */}
      <Card className="overflow-hidden">
        <div className="flex items-start justify-between gap-3 p-4">
          <ChartTitle align="left" divider>
            Disponibilidades
          </ChartTitle>
          <ButtonLink href="/cajas" variant="tonal" size="sm">
            Ver cajas
          </ButtonLink>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="px-4 py-2.5">Caja</th>
                <th className="px-4 py-2.5">Medio</th>
                <th className="px-4 py-2.5">Moneda</th>
                <th className="px-4 py-2.5 text-center">Saldo</th>
                <th className="px-4 py-2.5 text-center">Equivalente USD</th>
              </tr>
            </thead>
            <tbody>
              {p.activo.disponibilidades.cajas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-neutral-500">
                    No hay cajas cargadas.
                  </td>
                </tr>
              ) : (
                p.activo.disponibilidades.cajas.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2.5 font-medium text-neutral-800 text-start">
                      {c.nombre}
                      {!c.activa && (
                        <span className="ml-2 text-[11px] font-normal text-neutral-500">inactiva</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-neutral-600">{c.medio}</td>
                    <td className="px-4 py-2.5 text-neutral-600">
                      {c.moneda === "usd" ? "USD" : "ARS"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-center tabular-nums">
                      {c.moneda === "usd" ? fmtUsd(c.saldo) : fmtArs(c.saldo)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-center tabular-nums">
                      {c.enUsd === null ? (
                        <span className="text-amber-600">sin cotización</span>
                      ) : (
                        fmtUsd(c.enUsd)
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {p.activo.disponibilidades.cajas.length > 0 && (
              <tfoot>
                <tr className="border-t border-neutral-200">
                  <td className="px-4 py-2.5 font-semibold text-neutral-800" colSpan={4}>
                    Total
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-center font-semibold tabular-nums">
                    {fmtUsd(p.activo.disponibilidades.total)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {/* Créditos y saldos a favor */}
      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex items-start justify-between gap-3 p-4">
            <ChartTitle align="left" divider sub={`${p.activo.creditos.cantidadClientes} clientes · ${fmtUsd(p.activo.creditos.total)}`}>
              Clientes que deben
            </ChartTitle>
            <ButtonLink href="/cuentas-corrientes" variant="tonal" size="sm">
              Ver cuentas
            </ButtonLink>
          </div>
          <TopDeudores
            rows={p.activo.creditos.top}
            vacio="Nadie debe nada."
          />
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-start justify-between gap-3 p-4">
            <ChartTitle
              align="left"
              divider
              sub={`${p.pasivo.saldosAFavor.cantidadClientes} clientes · ${fmtUsd(p.pasivo.total)}`}
            >
              Saldos a favor de clientes
            </ChartTitle>
          </div>
          <TopDeudores rows={p.pasivo.saldosAFavor.top} vacio="Sin saldos a favor." />
        </Card>
      </div>

      {/* Inventario */}
      <Card className="overflow-hidden">
        <div className="flex items-start justify-between gap-3 p-4">
          <ChartTitle
            align="left"
            divider
            sub={`a costo · ${fmtUsd(p.activo.inventario.total)}${sinCosto > 0 ? ` · ${sinCosto} ítems sin costo` : ""}`}
          >
            Inventario
          </ChartTitle>
          <ButtonLink href="/inventario" variant="tonal" size="sm">
            Ver inventario
          </ButtonLink>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="px-4 py-2.5">Categoría</th>
                <th className="px-4 py-2.5 text-center">Unidades</th>
                <th className="px-4 py-2.5 text-center">Valor a costo</th>
                <th className="px-4 py-2.5 text-center">Valor de venta</th>
                <th className="px-4 py-2.5 text-center">Margen</th>
              </tr>
            </thead>
            <tbody>
              {p.activo.inventario.porCategoria.map((c) => (
                <FilaCategoria key={c.key} c={c} />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-neutral-200">
                <td className="px-4 py-2.5 font-semibold text-neutral-800" colSpan={2}>
                  Total
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-center font-semibold tabular-nums">
                  {fmtUsd(p.activo.inventario.total)}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-center font-semibold tabular-nums">
                  {fmtUsd(p.memo.inventarioAPrecioVenta)}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-center font-semibold tabular-nums">
                  {fmtUsd(p.memo.margenPotencial)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Memo: qué no incluye */}
      <Card className="p-4">
        <ChartTitle align="left" divider>
          Qué no incluye
        </ChartTitle>
        <ul className="space-y-1.5 text-sm text-neutral-600">
          {p.memo.trabajosEnCurso.cantidad > 0 && (
            <li>
              • <strong>Trabajos en curso:</strong> {p.memo.trabajosEnCurso.cantidad} tickets abiertos
              por {fmtUsd(p.memo.trabajosEnCurso.total)} (se cobran al entregar, no son un derecho
              todavía).
            </li>
          )}
          {p.memo.extraviadoACosto > 0 && (
            <li>
              • <strong>Extraviados a costo:</strong> {fmtUsd(p.memo.extraviadoACosto)} (pérdida
              potencial, no cuenta en el activo).
            </li>
          )}
          {p.memo.comprasPendientesSinPago.cantidad > 0 && (
            <li>
              • <strong>Compras pendientes sin pago registrado:</strong>{" "}
              {p.memo.comprasPendientesSinPago.cantidad} por{" "}
              {fmtUsd(p.memo.comprasPendientesSinPago.total)} (no salieron de ninguna caja, por eso no
              cuentan como anticipo).
            </li>
          )}
          {p.memo.movimientosSinCotizacion > 0 && (
            <li>
              • <strong>Movimientos en pesos sin cotización guardada:</strong>{" "}
              {p.memo.movimientosSinCotizacion}. No afecta este balance: el saldo de cada caja en
              pesos se convierte a la cotización de hoy.
            </li>
          )}
          <li>
            • <strong>No modelado:</strong> cuentas a pagar a proveedores, impuestos y sueldos.
          </li>
        </ul>
      </Card>
    </div>
  );
}

function FilaCategoria({ c }: { c: PatrimonioCategoria }) {
  return (
    <tr>
      <td className="px-4 py-2.5 font-medium text-neutral-800 text-start">
        {c.label}
        {c.sinCosto > 0 && (
          <span className="ml-2 text-[11px] font-normal text-neutral-500">
            {c.sinCosto} sin costo
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 text-center tabular-nums text-neutral-600">{c.unidades}</td>
      <td className="whitespace-nowrap px-4 py-2.5 text-center tabular-nums">{fmtUsd(c.valor)}</td>
      <td className="whitespace-nowrap px-4 py-2.5 text-center tabular-nums text-neutral-600">
        {c.valorVenta === null ? "—" : fmtUsd(c.valorVenta)}
      </td>
      <td className="whitespace-nowrap px-4 py-2.5 text-center tabular-nums text-neutral-600">
        {c.margen === null ? "—" : fmtUsd(c.margen)}
      </td>
    </tr>
  );
}

function TopDeudores({
  rows,
  vacio,
}: {
  rows: { clienteId: string; nombre: string; saldo: number }[];
  vacio: string;
}) {
  if (rows.length === 0) {
    return <p className="px-4 pb-4 text-sm text-neutral-500">{vacio}</p>;
  }
  return (
    <ul className="divide-y divide-neutral-100 border-t border-neutral-100">
      {rows.map((r) => (
        <li key={r.clienteId} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
          <span className="min-w-0 truncate text-neutral-700">{r.nombre}</span>
          <span className="shrink-0 tabular-nums font-medium">{fmtUsd(Math.abs(r.saldo))}</span>
        </li>
      ))}
    </ul>
  );
}
