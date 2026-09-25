import type { Cliente, Ticket, Venta } from "@/lib/types";

// ── Customer Intelligence: definiciones ─────────────────────────────────────
//
// Todo lo de este módulo sale de cruzar los arrays que la página de Analíticas
// ya trae (`clientes`, `ventas`, `tickets`) — ninguna query nueva, ningún dato
// inventado. Las definiciones son las de acá abajo y son las que usan los KPIs
// y los gráficos del tab Clientes de Analíticas:
//
// - **Operación**: una venta (cualquier `tipo`, mismo criterio que
//   `Cliente.compras` en `lib/db/clientes.ts`) o un ticket de reparación.
//   Los turnos NO son operaciones: son citas futuras, no actividad.
// - **Gasto**: `ventas.totalUsd`, misma base que `Cliente.gastadoUsd` (los
//   tickets se contabilizan como operaciones y por `presupuestoUsd` donde se
//   indica, igual que el tab Reparaciones — nunca mezclados con el gasto).
// - **Procedencia del cliente**: la de su primera venta con procedencia
//   cargada (el canal por el que llegó). Un cliente sin ventas (o ventas sin
//   procedencia) queda en "Sin dato".
//
// Mismo cuidado de huso horario que `lib/analiticas.ts`: las `fechaISO` se
// leen con `.slice()` y se parsean con `new Date(y, m-1, d)` local, nunca
// `new Date(iso)`.

/** Cliente activo: ≥1 operación en los últimos DIAS_ACTIVO días. */
export const DIAS_ACTIVO = 90;

/** Cliente en riesgo: con operaciones históricas y ninguna en los últimos
 * DIAS_RIESGO días (el doble de la ventana de "activo": dio señales de vida
 * dos ventanas seguidas y después se apagó). */
export const DIAS_RIESGO = 180;

/** Cliente nuevo para la lista de atención: primera operación en los últimos
 * DIAS_NUEVO días. */
export const DIAS_NUEVO = 30;

/** Etapa "Recurrente" del lifecycle: ≥ MIN_OPS_RECURRENTE operaciones (la
 * tasa de recurrencia del KPI usa ≥2, "volvió al menos una vez"; el lifecycle
 * distingue la tercera porque ahí el cliente ya demostró hábito). */
export const MIN_OPS_RECURRENTE = 3;

export type OpTipo = "venta" | "ticket";

/** Una operación del cliente, con su monto según el tipo (venta:
 * `totalUsd`, ticket: `presupuestoUsd`). */
export type OpCliente = { fechaISO: string; tipo: OpTipo; montoUsd: number };

export type ClienteIntel = {
  id: string;
  nombre: string;
  compras: number;
  reparaciones: number;
  /** compras + reparaciones. */
  operaciones: number;
  gastadoUsd: number;
  /** Canal de adquisición (procedencia de su primera venta); null = "Sin dato". */
  procedencia: string | null;
  /** Todas sus operaciones, ordenadas por fecha (asc). */
  ops: OpCliente[];
  primeraISO: string | null;
  ultimaISO: string | null;
  primeraTipo: OpTipo | null;
  /** Monto de la primera operación (venta: total, ticket: presupuesto). */
  primeraMontoUsd: number | null;
  /** Días desde la primera operación (antigüedad como cliente activo). */
  antiguedadDias: number | null;
  /** Días desde la última operación. */
  diasSinActividad: number | null;
  activo: boolean;
  enRiesgo: boolean;
};

const MESES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

/** "2026-09" -> "sep 26" — etiqueta de los gráficos por mes. */
export const mesCorto = (key: string) => {
  const [y, m] = key.split("-");
  return `${MESES[Number(m) - 1]} ${y.slice(2)}`;
};

/** "2026-09-07", hoy -> 18 (días transcurridos). Parseo local seguro (ver
 * nota de `lib/analiticas.ts`: nunca `new Date(iso)`). */
function diasDesdeISO(iso: string, hoy: Date): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.floor((hoy.getTime() - new Date(y, m - 1, d).getTime()) / 86_400_000);
}

/** Clave "YYYY-MM" de un `Date` local. */
const claveMes = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** "2026-09" + n meses -> "2026-11" (aritmética local, sin UTC). */
export function sumaMeses(key: string, n: number): string {
  const [y, m] = key.split("-").map(Number);
  return claveMes(new Date(y, m - 1 + n, 1));
}

/** El cruce base: un `Cliente` + toda su actividad real derivada de
 * `ventas`/`tickets` (mismos contadores que `lib/db/clientes.ts`, que no se
 * guardan en la tabla justamente para que nunca desincronicen). Ventas y
 * tickets de clientes que no están en `clientes` (baja lógica) no entran. */
export function clientesIntel(
  clientes: Cliente[],
  ventas: Venta[],
  tickets: Ticket[],
  hoy = new Date(),
): ClienteIntel[] {
  const ids = new Set(clientes.map((c) => c.id));

  type Acc = {
    ops: OpCliente[];
    gastadoUsd: number;
    /** Ventas con procedencia, para resolver el canal de adquisición. */
    primerasConProcedencia: { fechaISO: string; procedencia: string }[];
  };
  const acc = new Map<string, Acc>();
  const accDe = (id: string): Acc => {
    let a = acc.get(id);
    if (!a) {
      a = { ops: [], gastadoUsd: 0, primerasConProcedencia: [] };
      acc.set(id, a);
    }
    return a;
  };

  for (const v of ventas) {
    if (!v.clienteId || !ids.has(v.clienteId)) continue;
    const a = accDe(v.clienteId);
    a.ops.push({ fechaISO: v.fechaISO, tipo: "venta", montoUsd: v.totalUsd });
    a.gastadoUsd += v.totalUsd;
    if (v.procedencia) {
      a.primerasConProcedencia.push({ fechaISO: v.fechaISO, procedencia: v.procedencia });
    }
  }
  for (const t of tickets) {
    if (!t.clienteId || !ids.has(t.clienteId)) continue;
    accDe(t.clienteId).ops.push({
      fechaISO: t.fechaISO,
      tipo: "ticket",
      montoUsd: t.presupuestoUsd,
    });
  }

  return clientes.map((c) => {
    const a = acc.get(c.id) ?? { ops: [], gastadoUsd: 0, primerasConProcedencia: [] };
    // fecha ISO asc; "ticket" < "venta" solo desempata el mismo día
    a.ops.sort((x, y) =>
      x.fechaISO === y.fechaISO ? x.tipo.localeCompare(y.tipo) : x.fechaISO.localeCompare(y.fechaISO),
    );
    const primera = a.ops[0] ?? null;
    const ultima = a.ops[a.ops.length - 1] ?? null;
    // canal de adquisición: la procedencia más temprana entre las ventas que la traen
    const conProcedencia = [...a.primerasConProcedencia].sort((x, y) =>
      x.fechaISO.localeCompare(y.fechaISO),
    );
    const diasSinActividad = ultima ? diasDesdeISO(ultima.fechaISO, hoy) : null;
    return {
      id: c.id,
      nombre: c.nombre,
      compras: a.ops.filter((o) => o.tipo === "venta").length,
      reparaciones: a.ops.filter((o) => o.tipo === "ticket").length,
      operaciones: a.ops.length,
      gastadoUsd: a.gastadoUsd,
      procedencia: conProcedencia[0]?.procedencia ?? null,
      ops: a.ops,
      primeraISO: primera?.fechaISO ?? null,
      ultimaISO: ultima?.fechaISO ?? null,
      primeraTipo: primera?.tipo ?? null,
      primeraMontoUsd: primera?.montoUsd ?? null,
      antiguedadDias: primera ? diasDesdeISO(primera.fechaISO, hoy) : null,
      diasSinActividad,
      activo: diasSinActividad != null && diasSinActividad < DIAS_ACTIVO,
      enRiesgo:
        a.ops.length > 0 && diasSinActividad != null && diasSinActividad >= DIAS_RIESGO,
    };
  });
}

export type KpisClientes = {
  /** Clientes registrados (con o sin operaciones). */
  total: number;
  /** ≥1 operación en los últimos DIAS_ACTIVO días. */
  activos: number;
  /** % vs la ventana previa (los DIAS_ACTIVO días anteriores); null si la
   * ventana previa no tuvo clientes activos (no hay contra quién comparar). */
  deltaActivos: number | null;
  /** Gasto de la ventana (ventas de los últimos DIAS_ACTIVO días) ÷
   * clientes activos — el "valor por cliente activo" del período, comparable
   * contra la ventana previa. Toda venta de la ventana es de un cliente
   * activo por definición (la venta ES la operación). */
  valorPromedio: number;
  deltaValorPromedio: number | null;
  /** % de clientes con ≥2 operaciones sobre los que tienen ≥1 (clientes sin
   * operaciones no entran al denominador: todavía no hubo primera vez). */
  tasaRecurrencia: number;
  /** Con historial y sin operaciones en los últimos DIAS_RIESGO días. */
  enRiesgo: number;
  /** Gasto histórico total que representan los clientes en riesgo. */
  riesgoValorUsd: number;
};

export function kpisClientes(intel: ClienteIntel[], hoy = new Date()): KpisClientes {
  const total = intel.length;
  let activos = 0;
  let activosPrevios = 0;
  let gastoVentana = 0;
  let gastoVentanaPrevio = 0;
  for (const c of intel) {
    let activoAhora = false;
    let activoAntes = false;
    for (const o of c.ops) {
      const dias = diasDesdeISO(o.fechaISO, hoy);
      if (dias < DIAS_ACTIVO) {
        activoAhora = true;
        if (o.tipo === "venta") gastoVentana += o.montoUsd;
      } else if (dias < DIAS_RIESGO) {
        // ventana previa: los DIAS_ACTIVO días anteriores a la actual
        activoAntes = true;
        if (o.tipo === "venta") gastoVentanaPrevio += o.montoUsd;
      }
    }
    if (activoAhora) activos++;
    if (activoAntes) activosPrevios++;
  }

  const valorPromedio = activos > 0 ? gastoVentana / activos : 0;
  const valorPromedioPrevio = activosPrevios > 0 ? gastoVentanaPrevio / activosPrevios : 0;

  const conOperaciones = intel.filter((c) => c.operaciones >= 1).length;
  const conSegunda = intel.filter((c) => c.operaciones >= 2).length;
  const enRiesgo = intel.filter((c) => c.enRiesgo);

  return {
    total,
    activos,
    deltaActivos:
      activosPrevios > 0 ? ((activos - activosPrevios) / activosPrevios) * 100 : null,
    valorPromedio,
    deltaValorPromedio:
      valorPromedioPrevio > 0 ? ((valorPromedio - valorPromedioPrevio) / valorPromedioPrevio) * 100 : null,
    tasaRecurrencia: conOperaciones > 0 ? (conSegunda / conOperaciones) * 100 : 0,
    enRiesgo: enRiesgo.length,
    riesgoValorUsd: enRiesgo.reduce((a, c) => a + c.gastadoUsd, 0),
  };
}

// ── Cohort retention ──────────────────────────────────────────────────────────

export type CeldaCohorte = {
  /** Clientes de la cohorte con ≥1 operación en ese mes. */
  retornaron: number;
  /** % sobre el tamaño inicial de la cohorte; null = mes todavía no llegado. */
  pct: number | null;
};

export type CohorteFila = {
  /** "YYYY-MM" del mes de la primera operación. */
  key: string;
  label: string;
  /** Clientes cuya primera operación fue ese mes. */
  iniciales: number;
  /** M0..M6 — M0 es siempre 100% (la primera operación define la cohorte). */
  celdas: CeldaCohorte[];
};

export const COHORTE_MESES = 6; // columnas M0..M6

/** Cohort retention por mes de primera operación: cada celda = % de la
 * cohorte con ≥1 operación en ese mes (retención por actividad, no por
 * compra puntual — una reparación también es "volver"). Filas: los últimos
 * `filas` meses con cohortes (se recortan los vacíos del principio). */
export function cohortesClientes(
  intel: ClienteIntel[],
  hoy = new Date(),
  filas = 7,
): CohorteFila[] {
  const mesActual = claveMes(hoy);
  const porCohorte = new Map<string, { iniciales: number; meses: Set<string>[] }>();
  for (const c of intel) {
    if (!c.primeraISO) continue;
    const key = c.primeraISO.slice(0, 7);
    const fila =
      porCohorte.get(key) ??
      { iniciales: 0, meses: Array.from({ length: COHORTE_MESES + 1 }, () => new Set<string>()) };
    fila.iniciales += 1;
    for (let m = 0; m <= COHORTE_MESES; m++) {
      const mesOp = sumaMeses(key, m);
      // una operación cuenta para M<m> si cayó en ese mes exacto
      if (c.ops.some((o) => o.fechaISO.slice(0, 7) === mesOp)) fila.meses[m].add(c.id);
    }
    porCohorte.set(key, fila);
  }
  if (porCohorte.size === 0) return [];

  const primerMes = [...porCohorte.keys()].sort()[0];
  const meses: string[] = [];
  for (let m = filas - 1; m >= 0; m--) {
    const key = sumaMeses(mesActual, -m);
    if (key >= primerMes) meses.push(key);
  }
  return meses.map((key) => {
    const fila = porCohorte.get(key);
    const iniciales = fila?.iniciales ?? 0;
    return {
      key,
      label: mesCorto(key),
      iniciales,
      celdas: Array.from({ length: COHORTE_MESES + 1 }, (_, m) => {
        const mesCelda = sumaMeses(key, m);
        if (mesCelda > mesActual) return { retornaron: 0, pct: null };
        const retornaron = fila?.meses[m].size ?? 0;
        return {
          retornaron,
          pct: iniciales > 0 ? (retornaron / iniciales) * 100 : null,
        };
      }),
    };
  });
}

/** Clientes de una celda del heatmap (la cohorte `cohorteKey` que operó en
 * el mes offset `m` desde su primera operación) — para el drill-down. */
export function clientesDeCelda(
  intel: ClienteIntel[],
  cohorteKey: string,
  m: number,
): ClienteIntel[] {
  const mesOp = sumaMeses(cohorteKey, m);
  return intel.filter(
    (c) =>
      c.primeraISO?.slice(0, 7) === cohorteKey &&
      c.ops.some((o) => o.fechaISO.slice(0, 7) === mesOp),
  );
}

// ── Lifecycle (Sankey) ────────────────────────────────────────────────────────

export type MixTipo = "soloCompras" | "soloReparaciones" | "mixtos";

export type FlujoClientes = {
  /** Clientes con ≥1 operación, por tipo de la primera. */
  primera: { compra: number; reparacion: number };
  /** Clientes con ≥2, por tipo de la segunda. */
  segunda: { compra: number; reparacion: number };
  /** Clientes con ≥ MIN_OPS_RECURRENTE, por mix final. */
  recurrentes: { soloCompras: number; soloReparaciones: number; mixtos: number };
  /** 1ª → 2ª: del tipo de la primera al de la segunda. */
  flujosPrimera: { de: OpTipo; a: OpTipo; clientes: number }[];
  /** 2ª → recurrente: del tipo de la segunda al mix final. */
  flujosSegunda: { de: OpTipo; a: MixTipo; clientes: number }[];
  /** Clientes que ya superaron la ventana de riesgo, por etapa que
   * alcanzaron (1, 2 o ≥3 operaciones). */
  inactivos: { etapa: "primera" | "segunda" | "recurrentes"; clientes: number }[];
  /** Los que no avanzaron de etapa pero siguen dentro de la ventana de
   * riesgo (pueden volver — no se los cuenta como perdidos). */
  enCurso: number;
  /** Clientes con ≥1 operación (la entrada del flujo). */
  conOperaciones: number;
};

const mixDe = (c: ClienteIntel): MixTipo => {
  if (c.compras > 0 && c.reparaciones > 0) return "mixtos";
  return c.compras > 0 ? "soloCompras" : "soloReparaciones";
};

/** Recorrido de los clientes por etapas — la data del Sankey del lifecycle:
 * primera operación (compra/reparación) → segunda → recurrentes, con los
 * que se cayeron en cada etapa hacia "inactivos". Conservación: la suma de
 * los que avanzaron + los que se cayeron en cada etapa = los que empezaron. */
export function flujoClientes(intel: ClienteIntel[]): FlujoClientes {
  const conOps = intel.filter((c) => c.operaciones >= 1);

  const primera = { compra: 0, reparacion: 0 };
  const segunda = { compra: 0, reparacion: 0 };
  const recurrentes = { soloCompras: 0, soloReparaciones: 0, mixtos: 0 };
  const flujosPrimera = new Map<string, number>();
  const flujosSegunda = new Map<string, number>();
  const inactivos = {
    primera: 0,
    segunda: 0,
    recurrentes: 0,
  };

  for (const c of conOps) {
    const p = c.ops[0].tipo;
    if (p === "venta") primera.compra++; else primera.reparacion++;
    if (c.operaciones >= 2) {
      const s = c.ops[1].tipo;
      if (s === "venta") segunda.compra++; else segunda.reparacion++;
      flujosPrimera.set(`${p}>${s}`, (flujosPrimera.get(`${p}>${s}`) ?? 0) + 1);
      if (c.operaciones >= MIN_OPS_RECURRENTE) {
        const mix = mixDe(c);
        recurrentes[mix]++;
        flujosSegunda.set(`${s}>${mix}`, (flujosSegunda.get(`${s}>${mix}`) ?? 0) + 1);
      }
    }
    if (c.enRiesgo) {
      const etapa =
        c.operaciones >= MIN_OPS_RECURRENTE
          ? "recurrentes"
          : c.operaciones >= 2
            ? "segunda"
            : "primera";
      inactivos[etapa]++;
    }
  }

  const avanzaronPrimera = Object.values(primera).reduce((a, b) => a + b, 0);
  const avanzaronSegunda = Object.values(segunda).reduce((a, b) => a + b, 0);
  const recurrentesTotal = Object.values(recurrentes).reduce((a, b) => a + b, 0);
  const inactivosTotal = inactivos.primera + inactivos.segunda + inactivos.recurrentes;

  return {
    primera,
    segunda,
    recurrentes,
    flujosPrimera: [...flujosPrimera.entries()].map(([k, clientes]) => {
      const [de, a] = k.split(">") as [OpTipo, OpTipo];
      return { de, a, clientes };
    }),
    flujosSegunda: [...flujosSegunda.entries()].map(([k, clientes]) => {
      const [de, a] = k.split(">") as [OpTipo, MixTipo];
      return { de, a, clientes };
    }),
    inactivos: (["primera", "segunda", "recurrentes"] as const).map((etapa) => ({
      etapa,
      clientes: inactivos[etapa],
    })),
    enCurso: avanzaronPrimera - avanzaronSegunda - inactivos.primera
      + (avanzaronSegunda - recurrentesTotal - inactivos.segunda),
    conOperaciones: conOps.length,
  };
}

// ── Procedencia (adquisición) ────────────────────────────────────────────────

export type ProcedenciaRow = {
  /** "Instagram", "WhatsApp", … o "Sin dato" (sin ventas con procedencia). */
  label: string;
  /** Clientes cuyo canal de adquisición es este. */
  clientes: number;
  /** % sobre el total de clientes. */
  pct: number;
  /** Gasto histórico total de esos clientes — el canal con más clientes no
   * es necesariamente el que más valor genera. */
  valorUsd: number;
};

export const SIN_PROCEDENCIA = "Sin dato";

/** Ranking de adquisición por canal (procedencia de la primera venta de
 * cada cliente), ordenado por cantidad de clientes. */
export function procedenciaRanking(intel: ClienteIntel[]): ProcedenciaRow[] {
  const total = intel.length;
  const por = new Map<string, { clientes: number; valorUsd: number }>();
  for (const c of intel) {
    const label = c.procedencia ?? SIN_PROCEDENCIA;
    const fila = por.get(label) ?? { clientes: 0, valorUsd: 0 };
    fila.clientes++;
    fila.valorUsd += c.gastadoUsd;
    por.set(label, fila);
  }
  return [...por.entries()]
    .map(([label, v]) => ({
      label,
      clientes: v.clientes,
      pct: total > 0 ? (v.clientes / total) * 100 : 0,
      valorUsd: v.valorUsd,
    }))
    .sort((a, b) => b.clientes - a.clientes);
}

// ── Ingresos por mes: nuevos vs existentes ───────────────────────────────────

export type IngresoMes = {
  key: string;
  label: string;
  compras: number;
  reparaciones: number;
  total: number;
  comprasNuevos: number;
  comprasExistentes: number;
  reparacionesNuevos: number;
  reparacionesExistentes: number;
  totalNuevos: number;
  totalExistentes: number;
};

/** Ingresos por mes separando el aporte de clientes NUEVOS (su primera
 * operación fue ese mismo mes) del de EXISTENTES — dice si el negocio se
 * apoya en adquisición o en recurrencia. Compras = `ventas.totalUsd`
 * (mismo criterio que el gasto), reparaciones = `tickets.presupuestoUsd`
 * (mismo criterio que el tab Reparaciones). Ventas/tickets de clientes
 * desconocidos (baja lógica) cuentan como existentes. Se completan los
 * meses sin actividad en 0 para que la línea no salte períodos. */
export function ingresosPorMesClientes(
  ventas: Venta[],
  tickets: Ticket[],
  intel: ClienteIntel[],
  hoy = new Date(),
  meses = 12,
): IngresoMes[] {
  const primeraMes = new Map<string, string>();
  for (const c of intel) {
    if (c.primeraISO) primeraMes.set(c.id, c.primeraISO.slice(0, 7));
  }
  const esNuevo = (clienteId: string, mesKey: string) =>
    primeraMes.get(clienteId) === mesKey;

  const mesesData = new Map<
    string,
    Omit<IngresoMes, "key" | "label" | "compras" | "reparaciones" | "total" | "totalNuevos" | "totalExistentes">
  >();
  const filaDe = (key: string) => {
    let f = mesesData.get(key);
    if (!f) {
      f = {
        comprasNuevos: 0,
        comprasExistentes: 0,
        reparacionesNuevos: 0,
        reparacionesExistentes: 0,
      };
      mesesData.set(key, f);
    }
    return f;
  };
  for (const v of ventas) {
    const key = v.fechaISO.slice(0, 7);
    const f = filaDe(key);
    if (v.clienteId && esNuevo(v.clienteId, key)) f.comprasNuevos += v.totalUsd;
    else f.comprasExistentes += v.totalUsd;
  }
  for (const t of tickets) {
    const key = t.fechaISO.slice(0, 7);
    const f = filaDe(key);
    if (t.clienteId && esNuevo(t.clienteId, key)) f.reparacionesNuevos += t.presupuestoUsd;
    else f.reparacionesExistentes += t.presupuestoUsd;
  }
  if (mesesData.size === 0) return [];

  const mesActual = claveMes(hoy);
  const keys = [...mesesData.keys()].sort();
  // desde el primer mes con actividad hasta el actual, tope de `meses`
  const out: IngresoMes[] = [];
  let key = keys[0] > sumaMeses(mesActual, -(meses - 1)) ? keys[0] : sumaMeses(mesActual, -(meses - 1));
  while (key <= mesActual) {
    const f = mesesData.get(key) ?? {
      comprasNuevos: 0,
      comprasExistentes: 0,
      reparacionesNuevos: 0,
      reparacionesExistentes: 0,
    };
    const compras = f.comprasNuevos + f.comprasExistentes;
    const reparaciones = f.reparacionesNuevos + f.reparacionesExistentes;
    out.push({
      key,
      label: mesCorto(key),
      compras,
      reparaciones,
      total: compras + reparaciones,
      ...f,
      totalNuevos: f.comprasNuevos + f.reparacionesNuevos,
      totalExistentes: f.comprasExistentes + f.reparacionesExistentes,
    });
    key = sumaMeses(key, 1);
  }
  return out;
}
