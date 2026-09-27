"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { cn } from "@/lib/utils";
import { fmtUsd, fmtDateSlash } from "@/lib/format";
import {
  DIAS_NUEVO,
  DIAS_RIESGO,
  SIN_PROCEDENCIA,
  type ClienteIntel,
} from "@/lib/clientes-inteligencia";

/** Las tres listas accionables del tab: a quién llamar hoy. No hay métricas
 *  nuevas acá -- son los mismos `ClienteIntel` ordenados por lo que ya
 *  hicieron (gasto) o dejaron de hacer (días sin actividad). Click abre la
 *  ficha del cliente. */
export function AtencionClientes({ intel }: { intel: ClienteIntel[] }) {
  const canalDe = (c: ClienteIntel) => c.procedencia ?? SIN_PROCEDENCIA;

  const altoValor = [...intel]
    .filter((c) => c.operaciones > 0)
    .sort((a, b) => b.gastadoUsd - a.gastadoUsd)
    .slice(0, 5);

  const enRiesgo = [...intel]
    .filter((c) => c.enRiesgo)
    .sort((a, b) => b.gastadoUsd - a.gastadoUsd)
    .slice(0, 5);

  const nuevos = [...intel]
    .filter(
      (c) => c.primeraISO != null && c.antiguedadDias != null && c.antiguedadDias <= DIAS_NUEVO,
    )
    .sort((a, b) => (b.primeraISO ?? "").localeCompare(a.primeraISO ?? ""))
    .slice(0, 5);

  return (
    <Card className="p-5">
      <ChartTitle align="left" divider sub="a quién contactar hoy · click abre la ficha">
        Atención
      </ChartTitle>
      <div className="mt-3 space-y-4 border-t border-neutral-100 pt-3">
        <Grupo titulo="Alto valor" count={altoValor.length}>
          {altoValor.length === 0 ? (
            <Vacio texto="Sin clientes con operaciones todavía." />
          ) : (
            altoValor.map((c) => (
              <Fila
                key={c.id}
                cliente={c}
                sub={`${c.operaciones} ops · ${canalDe(c) === SIN_PROCEDENCIA ? "sin dato de canal" : canalDe(c)}`}
                valor={fmtUsd(c.gastadoUsd)}
                extra={`últ. ${c.ultimaISO ? fmtDateSlash(c.ultimaISO) : "—"}`}
              />
            ))
          )}
        </Grupo>

        <Grupo
          titulo="En riesgo"
          count={enRiesgo.length}
          sub={`sin actividad hace más de ${DIAS_RIESGO} días`}
        >
          {enRiesgo.length === 0 ? (
            <Vacio texto={`Nadie superó los ${DIAS_RIESGO} días sin volver.`} />
          ) : (
            enRiesgo.map((c) => (
              <Fila
                key={c.id}
                cliente={c}
                sub={`${c.operaciones} ops · última ${c.ultimaISO ? fmtDateSlash(c.ultimaISO) : "—"}`}
                valor={fmtUsd(c.gastadoUsd)}
                extra={`hace ${fmtNumDias(c.diasSinActividad)} días`}
                extraClassName="text-red-500"
              />
            ))
          )}
        </Grupo>

        <Grupo titulo="Nuevos" count={nuevos.length} sub={`primera operación en los últimos ${DIAS_NUEVO} días`}>
          {nuevos.length === 0 ? (
            <Vacio texto="Sin clientes nuevos en la ventana." />
          ) : (
            nuevos.map((c) => (
              <Fila
                key={c.id}
                cliente={c}
                sub={`desde ${c.primeraISO ? fmtDateSlash(c.primeraISO) : "—"} · ${
                  canalDe(c) === SIN_PROCEDENCIA ? "sin dato de canal" : canalDe(c)
                }`}
                valor={c.primeraMontoUsd != null ? fmtUsd(c.primeraMontoUsd) : "—"}
                extra={`1ª ${c.primeraTipo === "venta" ? "compra" : "reparación"}`}
              />
            ))
          )}
        </Grupo>
      </div>
    </Card>
  );
}

function Grupo({
  titulo,
  count,
  sub,
  children,
}: {
  titulo: string;
  count: number;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
          {titulo}
        </p>
        <span className="rounded-full bg-neutral-100 px-1.5 text-[10px] font-semibold tabular-nums text-neutral-500">
          {count}
        </span>
        {sub && <span className="text-[10px] text-neutral-300">{sub}</span>}
      </div>
      <div className="mt-1 space-y-0.5">{children}</div>
    </div>
  );
}

function Fila({
  cliente,
  sub,
  valor,
  extra,
  extraClassName,
}: {
  cliente: ClienteIntel;
  sub: string;
  valor: string;
  extra?: string;
  extraClassName?: string;
}) {
  return (
    <Link
      href={`/clientes?open=${cliente.id}`}
      className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-neutral-50"
    >
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-neutral-800">
          {cliente.nombre}
        </p>
        <p className="truncate text-[10px] text-neutral-400">{sub}</p>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {extra && (
          <span className={cn("text-[10px] tabular-nums text-neutral-400", extraClassName)}>
            {extra}
          </span>
        )}
        <span className="text-xs font-semibold tabular-nums text-neutral-700">
          {valor}
        </span>
      </div>
    </Link>
  );
}

function Vacio({ texto }: { texto: string }) {
  return <p className="px-2 py-1.5 text-[11px] text-neutral-400">{texto}</p>;
}

function fmtNumDias(n: number | null) {
  return n == null ? "—" : n.toLocaleString("es-AR");
}
