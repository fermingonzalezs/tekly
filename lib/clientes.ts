/** Lógica pura de "Demografía de clientes · edad" -- sin Supabase, testeable
 * sin red. `lib/db/clientes.ts` trae los clientes reales y le pasa acá solo
 * `fechaNacimiento`/`desde` en ISO. */

export type RangoEdad = { rango: string; pct: number };
export type Periodo = "historico" | "mes" | "semana";

const RANGOS: { rango: string; min: number; max: number }[] = [
  { rango: "18–24", min: 18, max: 24 },
  { rango: "25–34", min: 25, max: 34 },
  { rango: "35–44", min: 35, max: 44 },
  { rango: "45–54", min: 45, max: 54 },
  { rango: "55+", min: 55, max: Infinity },
];

function edadAl(fechaNacimientoISO: string, hoy: Date): number {
  const [y, m, d] = fechaNacimientoISO.split("-").map(Number);
  let edad = hoy.getFullYear() - y;
  const huboCumple =
    hoy.getMonth() + 1 > m || (hoy.getMonth() + 1 === m && hoy.getDate() >= d);
  if (!huboCumple) edad--;
  return edad;
}

function inicioDeMes(hoy: Date): Date {
  return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
}

function hace7Dias(hoy: Date): Date {
  return new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 6);
}

function distribucion(edades: number[]): RangoEdad[] {
  if (edades.length === 0) return RANGOS.map((r) => ({ rango: r.rango, pct: 0 }));
  return RANGOS.map((r) => {
    const enRango = edades.filter((e) => e >= r.min && e <= r.max).length;
    return { rango: r.rango, pct: Math.round((enRango / edades.length) * 100) };
  });
}

/** Un cliente sin `fechaNacimiento` queda afuera del cálculo (no "no
 * declarado" en un rango, directamente no cuenta ni para el total). */
export function demografiaClientes(
  clientes: { fechaNacimiento?: string; desdeISO: string }[],
  hoy = new Date(),
): Record<Periodo, RangoEdad[]> {
  const conEdad = clientes
    .filter((c) => c.fechaNacimiento)
    .map((c) => ({ edad: edadAl(c.fechaNacimiento!, hoy), desde: new Date(c.desdeISO) }));

  const inicioMes = inicioDeMes(hoy);
  const inicioSemana = hace7Dias(hoy);

  return {
    historico: distribucion(conEdad.map((c) => c.edad)),
    mes: distribucion(conEdad.filter((c) => c.desde >= inicioMes).map((c) => c.edad)),
    semana: distribucion(conEdad.filter((c) => c.desde >= inicioSemana).map((c) => c.edad)),
  };
}
