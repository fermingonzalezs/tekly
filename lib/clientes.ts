import { normalizarInstagram } from "@/lib/instagram";
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

// ── Fecha de nacimiento en formularios (DD/MM/AAAA) ──

/** "15/5/2000abc" -> "15/05/2000" mientras se escribe -- solo dígitos,
 * inserta las barras solo, máximo 8 dígitos (DDMMAAAA). */
export function maskFechaDDMMAAAA(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const partes = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  return partes.join("/");
}

/** "15/05/2000" -> "2000-05-15" (lo que espera la columna `date`).
 * `undefined` si está incompleta o el rango no es plausible. */
export function fechaDDMMAAAAaIso(ddmmaaaa: string): string | undefined {
  const m = ddmmaaaa.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return undefined;
  const [, dd, mm, yyyy] = m;
  const d = Number(dd);
  const mo = Number(mm);
  const y = Number(yyyy);
  if (d < 1 || d > 31 || mo < 1 || mo > 12 || y < 1900) return undefined;
  return `${yyyy}-${mm}-${dd}`;
}

/** "2000-05-15" -> "15/05/2000", para precargar el input al editar. */
export function isoAFechaDDMMAAAA(iso?: string): string {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

// ── Formulario de cliente (alta rápida de Nueva venta y sección Clientes) ──

/** Lo que se tipea en el formulario de un cliente (la fecha en DD/MM/AAAA). */
export type BorradorCliente = {
  nombre: string;
  telefono: string;
  email: string;
  instagram: string;
  nacimiento: string;
};

export const BORRADOR_CLIENTE_VACIO: BorradorCliente = {
  nombre: "",
  telefono: "",
  email: "",
  instagram: "",
  nacimiento: "",
};

/** Error por campo (o `null`) y si el borrador se puede guardar. Mismas
 * reglas en el alta rápida de Nueva venta y en la sección Clientes: solo el
 * nombre es obligatorio; Instagram y fecha se validan si se cargaron. */
export function validarBorradorCliente(b: BorradorCliente) {
  const ig = normalizarInstagram(b.instagram);
  const errores = {
    instagram: ig.ok ? null : ig.error,
    nacimiento:
      b.nacimiento && !fechaDDMMAAAAaIso(b.nacimiento) ? "Completá la fecha como DD/MM/AAAA." : null,
  };
  return { errores, valido: !!b.nombre.trim() && !errores.instagram && !errores.nacimiento };
}

/** Datos listos para guardar (vacío = sin dato). */
export function datosDeBorrador(b: BorradorCliente) {
  const ig = normalizarInstagram(b.instagram);
  return {
    nombre: b.nombre.trim(),
    telefono: b.telefono.trim() || undefined,
    email: b.email.trim() || undefined,
    instagram: ig.ok ? (ig.usuario ?? undefined) : undefined,
    fechaNacimiento: fechaDDMMAAAAaIso(b.nacimiento),
  };
}
