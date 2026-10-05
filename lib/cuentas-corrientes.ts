import type { ClienteOpcion, MovimientoCC } from "@/lib/types";

/** Saldo de un cliente: cargos suman deuda, pagos la reducen. Positivo =
 * debe, negativo = a favor, 0 = al día. Pura -- sin Supabase -- para poder
 * importarla tanto desde `lib/db/cuentas-corrientes.ts` (server) como desde
 * el client component sin arrastrar `server-only`. */
export function saldoDe(
  movimientos: Pick<MovimientoCC, "clienteId" | "tipo" | "montoUsd">[],
  clienteId: string,
): number {
  return movimientos
    .filter((m) => m.clienteId === clienteId)
    .reduce((a, m) => a + (m.tipo === "cargo" ? m.montoUsd : -m.montoUsd), 0);
}

export type SaldoPorCliente = {
  clienteId: string;
  nombre: string;
  saldo: number;
};

/** Ranking de deuda por cliente (positivo = debe). Ordenado de mayor a
 * menor y topeado a `top` -- alimenta "Deuda por cliente" sin reimplementar
 * la agrupación por cliente fuera de acá. */
export function deudaPorCliente(
  movimientos: Pick<MovimientoCC, "clienteId" | "tipo" | "montoUsd">[],
  clientes: Pick<ClienteOpcion, "id" | "nombre">[],
  top = 8,
): SaldoPorCliente[] {
  return clientes
    .map((c) => ({
      clienteId: c.id,
      nombre: c.nombre,
      saldo: saldoDe(movimientos, c.id),
    }))
    .filter((r) => r.saldo > 0)
    .sort((a, b) => b.saldo - a.saldo)
    .slice(0, top);
}

export type CargosPagosPorMes = {
  labels: string[];
  cargos: number[];
  pagos: number[];
};

const MESES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

/** "2026-09" -> "sep 2026", sin `new Date` (huso horario). */
function etiquetaMes(ym: string): string {
  const [y, m] = ym.split("-");
  const label = MESES[Number(m) - 1] ?? m;
  return `${label} ${y}`;
}

/** Cargos vs pagos agrupados por mes (según `fechaISO`), meses ascendentes.
 * Alimenta el gráfico de barras agrupadas de la sección. */
export function cargosPagosPorMes(
  movimientos: Pick<MovimientoCC, "fechaISO" | "tipo" | "montoUsd">[],
): CargosPagosPorMes {
  const map = new Map<string, { cargos: number; pagos: number }>();
  for (const m of movimientos) {
    const mes = m.fechaISO.slice(0, 7);
    const acc = map.get(mes) ?? { cargos: 0, pagos: 0 };
    if (m.tipo === "cargo") acc.cargos += m.montoUsd;
    else acc.pagos += m.montoUsd;
    map.set(mes, acc);
  }
  const meses = [...map.keys()].sort();
  return {
    labels: meses.map(etiquetaMes),
    cargos: meses.map((m) => map.get(m)!.cargos),
    pagos: meses.map((m) => map.get(m)!.pagos),
  };
}
