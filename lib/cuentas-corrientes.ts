import type { MovimientoCC } from "@/lib/types";

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
