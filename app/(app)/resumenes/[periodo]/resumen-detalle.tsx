"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { StatCard } from "@/components/ui/stat-card";
import { ReciboCampos, ReciboImprimir, ReciboLineas } from "@/components/recibos/recibo";
import { fmtArs, fmtDateSlash, fmtPct, fmtUsd } from "@/lib/format";
import { etiquetaPeriodo, type ResumenMensual } from "@/lib/resumen-mensual";
import type { Negocio } from "@/lib/db/configuracion";

type Fila = [string, string];
type Ranking = { titulo: string; filas: { label: string; value: number }[] };
type Seccion = { titulo: string; sub?: string; filas: Fila[]; rankings?: Ranking[] };

const pct = (n: number) => `${n.toFixed(1)} %`;

/** Una sola definición de lo que muestra cada sección: la pantalla y el PDF
 *  se dibujan desde acá, así nunca divergen. */
function armarSecciones(r: ResumenMensual): Seccion[] {
  const v = r.ventas;
  const d = v.deltas.facturacion;
  return [
    {
      titulo: "Ventas",
      filas: [
        ["Facturado", fmtUsd(v.facturacionUsd) + (d !== undefined ? ` (${fmtPct(d)} vs mes anterior)` : "")],
        ["Operaciones", String(v.operaciones)],
        ["Ticket promedio", fmtUsd(v.ticketPromedioUsd)],
        ["Ganancia", fmtUsd(v.gananciaUsd)],
        ["Margen", v.margenPct === null ? "— (sin costos cargados)" : pct(v.margenPct)],
        ...(r.objetivo
          ? ([["Objetivo del mes", `${fmtUsd(r.objetivo.objetivoUsd)} · cumplido ${r.objetivo.cumplidoPct === null ? "—" : pct(r.objetivo.cumplidoPct)}`]] as Fila[])
          : []),
      ],
      rankings: [
        { titulo: "Por rubro", filas: v.porRubro },
        { titulo: "Por vendedor", filas: v.porVendedor },
        { titulo: "Por medio de pago", filas: v.porMedio },
        { titulo: "Por canal", filas: v.porCanal },
      ],
    },
    {
      titulo: "Reparaciones",
      filas: [
        ["Tickets ingresados", String(r.reparaciones.tickets)],
        ["Cobrado", fmtUsd(r.reparaciones.cobradoUsd)],
        ["  · en caja", fmtUsd(r.reparaciones.cobradoCajaUsd)],
        ["  · a cuenta corriente", fmtUsd(r.reparaciones.cobradoCuentaCorrienteUsd)],
        ["Gasto en repuestos", fmtUsd(r.reparaciones.gastoRepuestosUsd)],
        ["Ganancia", fmtUsd(r.reparaciones.gananciaUsd)],
      ],
      rankings: [
        {
          titulo: "Fallas más facturadas",
          filas: r.reparaciones.porFalla.map((f) => ({ label: `${f.falla} (${f.tickets})`, value: f.totalUsd })),
        },
      ],
    },
    {
      titulo: "Compras",
      filas: [
        ["Compras a proveedores", fmtUsd(r.compras.totalUsd)],
        ["Cantidad", String(r.compras.cantidad)],
        ["Equipos recibidos en canje", String(r.compras.canjes)],
      ],
      rankings: [{ titulo: "Por proveedor", filas: r.compras.porProveedor }],
    },
    {
      titulo: "Caja",
      filas: [
        ["Ingresos", fmtUsd(r.caja.ingresosUsd)],
        ["Egresos", fmtUsd(r.caja.egresosUsd)],
        ["Neto", fmtUsd(r.caja.netoUsd)],
        ...(r.caja.movimientosArsSinCotizacion > 0
          ? ([["Sin cotización (no suman)", `${r.caja.movimientosArsSinCotizacion} mov. en pesos`]] as Fila[])
          : []),
      ],
    },
    {
      titulo: "Cuentas corrientes",
      sub: "Saldos: foto al generar",
      filas: [
        ["Cargos del mes", fmtUsd(r.cuentasCorrientes.cargosUsd)],
        ["Pagos del mes", fmtUsd(r.cuentasCorrientes.pagosUsd)],
        ["Por cobrar", fmtUsd(r.cuentasCorrientes.porCobrarUsd)],
        ["Saldos a favor de clientes", fmtUsd(r.cuentasCorrientes.saldosAFavorUsd)],
      ],
    },
    {
      titulo: "Inventario",
      sub: "Foto al generar",
      filas: [
        ["Valor a costo", fmtUsd(r.inventario.valorUsd)],
        ["Unidades en stock", String(r.inventario.unidades)],
        ["Inmovilizado (> 90 días)", fmtUsd(r.inventario.inmovilizadoUsd)],
        ["Entradas / salidas del mes", `${r.inventario.entradas} / ${r.inventario.salidas}`],
        ["Bajas", String(r.inventario.bajas)],
      ],
      rankings: [
        {
          titulo: "Valor por categoría",
          filas: r.inventario.porCategoria.map((c) => ({
            label: `${c.categoria} (${c.unidades} u)`,
            value: c.valorUsd,
          })),
        },
      ],
    },
    {
      titulo: "Clientes",
      filas: [
        ["Registrados", String(r.clientes.total)],
        ["Nuevos en el mes", String(r.clientes.nuevos)],
        ["Activos (90 días)", String(r.clientes.activos)],
        ["En riesgo", String(r.clientes.enRiesgo)],
        ["Tasa de recurrencia", pct(r.clientes.tasaRecurrenciaPct)],
      ],
    },
    {
      titulo: "Turnos",
      filas: [
        ["Agendados", String(r.turnos.total)],
        ["Confirmados", String(r.turnos.confirmados)],
        ["Cancelados", String(r.turnos.cancelados)],
        ["Pendientes", String(r.turnos.pendientes)],
      ],
    },
    ...(r.patrimonio
      ? [
          {
            titulo: "Patrimonio",
            sub: `Foto al generar · dólar blue ${fmtArs(r.cotizacion.valor ?? 0)}`,
            filas: [
              ["Disponibilidades", fmtUsd(r.patrimonio.disponibilidadesUsd)],
              ["Créditos", fmtUsd(r.patrimonio.creditosUsd)],
              ["Inventario", fmtUsd(r.patrimonio.inventarioUsd)],
              ["Anticipos a proveedores", fmtUsd(r.patrimonio.anticiposUsd)],
              ["Activo", fmtUsd(r.patrimonio.activoUsd)],
              ["Pasivo", fmtUsd(r.patrimonio.pasivoUsd)],
              ["Patrimonio neto", fmtUsd(r.patrimonio.netoUsd)],
            ] as Fila[],
          },
        ]
      : []),
  ];
}

export function ResumenDetalle({
  resumen: r,
  origen,
  generadoAt,
  negocio,
}: {
  resumen: ResumenMensual;
  origen: "cron" | "manual";
  generadoAt: string;
  negocio: Negocio;
}) {
  const [pdf, setPdf] = useState(false);
  const secciones = armarSecciones(r);
  const titulo = etiquetaPeriodo(r.periodo);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/resumenes"
            aria-label="Volver a resúmenes"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-accent-soft hover:text-accent"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold capitalize text-neutral-900">{titulo}</h1>
            <p className="text-xs text-neutral-500">
              Generado el {fmtDateSlash(generadoAt)} ·{" "}
              {origen === "cron" ? "automático a fin de mes" : "generado a mano"}
            </p>
          </div>
        </div>
        <Button icon={Printer} variant="tonal" onClick={() => setPdf(true)}>
          Imprimir / PDF
        </Button>
      </div>

      {!r.foto.fiable && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Este resumen se generó después del cierre del mes: ventas, reparaciones, compras y caja
          son exactos (salen de las fechas), pero <strong>inventario, saldos y patrimonio</strong>{" "}
          reflejan el día en que se generó, no el cierre.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Facturado"
          value={fmtUsd(r.ventas.facturacionUsd)}
          delta={r.ventas.deltas.facturacion}
        />
        <StatCard label="Ganancia" value={fmtUsd(r.ventas.gananciaUsd)} hint="de las ventas" />
        <StatCard label="Reparaciones cobradas" value={fmtUsd(r.reparaciones.cobradoUsd)} hint="en el mes" />
        <StatCard
          label="Patrimonio neto"
          value={r.patrimonio ? fmtUsd(r.patrimonio.netoUsd) : "—"}
          hint={r.patrimonio ? "al generar" : "sin cotización"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {secciones.map((s) => (
          <Card key={s.titulo} className="p-5">
            <ChartTitle align="left" divider sub={s.sub}>
              {s.titulo}
            </ChartTitle>
            <dl className="divide-y divide-neutral-100 text-sm">
              {s.filas.map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 py-1.5">
                  <dt className="whitespace-pre text-neutral-600">{k}</dt>
                  <dd className="text-right font-medium tabular-nums text-neutral-900">{v}</dd>
                </div>
              ))}
            </dl>
            {s.rankings?.map(
              (rk) =>
                rk.filas.length > 0 && (
                  <div key={rk.titulo} className="mt-4">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                      {rk.titulo}
                    </p>
                    <ul className="divide-y divide-neutral-100 text-sm">
                      {rk.filas.map((f) => (
                        <li key={f.label} className="flex items-baseline justify-between gap-4 py-1">
                          <span className="min-w-0 truncate text-neutral-700">{f.label}</span>
                          <span className="tabular-nums text-neutral-900">{fmtUsd(f.value)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
            )}
          </Card>
        ))}
      </div>

      <ReciboImprimir
        key={pdf ? "pdf-open" : "pdf-none"}
        open={pdf}
        onClose={() => setPdf(false)}
        titulo="Resumen mensual"
        nro={titulo}
        fecha={fmtDateSlash(generadoAt)}
        cliente=""
        negocio={negocio}
        sinFirmas
        paginas={[
          {
            titulo: "Resumen mensual",
            compacto: true,
            sinCliente: true,
            children: (
              <>
                {secciones.map((s) => (
                  <div key={s.titulo} className="mt-8 print:break-inside-avoid-page">
                    <p className="mb-1 border-b border-accent/20 pb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-accent">
                      {s.titulo}
                      {s.sub ? ` · ${s.sub}` : ""}
                    </p>
                    <ReciboCampos className="mt-3" variant="inline" separadores filas={s.filas} />
                    {s.rankings?.map(
                      (rk) =>
                        rk.filas.length > 0 && (
                          <ReciboLineas
                            key={rk.titulo}
                            titulo={rk.titulo}
                            lineas={rk.filas.map((f) => ({ detalle: f.label, montoUsd: f.value }))}
                          />
                        ),
                    )}
                  </div>
                ))}
              </>
            ),
          },
        ]}
      />
    </div>
  );
}
