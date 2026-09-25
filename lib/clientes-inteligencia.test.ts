import { describe, expect, it } from "vitest";
import {
  DIAS_ACTIVO,
  DIAS_RIESGO,
  MIN_OPS_RECURRENTE,
  SIN_PROCEDENCIA,
  clientesIntel,
  clientesDeCelda,
  cohortesClientes,
  flujoClientes,
  ingresosPorMesClientes,
  kpisClientes,
  mesCorto,
  procedenciaRanking,
  sumaMeses,
} from "@/lib/clientes-inteligencia";
import type { Cliente, Ticket, Venta } from "@/lib/types";

const HOY = new Date(2026, 8, 25); // 25 sep 2026 — todas las fechas locales

function cliente(id: string): Cliente {
  return {
    id,
    nombre: `Cliente ${id}`,
    telefono: "—",
    email: "—",
    desde: "sep 2026",
    compras: 0,
    reparaciones: 0,
    gastadoUsd: 0,
  };
}

function venta(clienteId: string, fechaISO: string, totalUsd: number, procedencia?: string): Venta {
  return {
    id: `V-${fechaISO}-${clienteId}`,
    fecha: "",
    fechaISO,
    clienteId,
    cliente: "",
    vendedorId: "",
    vendedor: "",
    procedencia,
    items: [],
    totalUsd,
    pagos: [],
    margenPct: 0,
    tipo: "venta",
    modalidad: "minorista",
  };
}

function ticket(clienteId: string, fechaISO: string, presupuestoUsd = 100): Ticket {
  return {
    id: 1,
    clienteId,
    cliente: "",
    equipo: "iPhone 13",
    imei: "—",
    falla: "Pantalla",
    estado: "entregado",
    ingreso: "",
    fechaISO,
    presupuestoUsd,
    servicios: [],
    tecnicoId: null,
    tecnico: null,
  };
}

describe("clientesIntel", () => {
  it("cuenta compras/reparaciones/operaciones y gasto desde ventas+tickets", () => {
    const [c] = clientesIntel(
      [cliente("c1")],
      [venta("c1", "2026-09-01", 300), venta("c1", "2026-09-10", 200)],
      [ticket("c1", "2026-08-01")],
      HOY,
    );
    expect(c.compras).toBe(2);
    expect(c.reparaciones).toBe(1);
    expect(c.operaciones).toBe(3);
    expect(c.gastadoUsd).toBe(500);
  });

  it("ignora las operaciones de clientes que no están en la lista (baja lógica)", () => {
    const [c] = clientesIntel([cliente("c1")], [venta("c2", "2026-09-01", 300)], [], HOY);
    expect(c.operaciones).toBe(0);
  });

  it("procedencia = la de la primera venta que la trae, no la última", () => {
    const [c] = clientesIntel(
      [cliente("c1")],
      [venta("c1", "2026-09-10", 100, "Instagram"), venta("c1", "2026-09-01", 100, "Local")],
      [],
      HOY,
    );
    expect(c.procedencia).toBe("Local");
  });

  it("sin ventas (o sin procedencia cargada) queda en null", () => {
    const [soloTicket, sinDato] = clientesIntel(
      [cliente("c1"), cliente("c2")],
      [venta("c2", "2026-09-01", 100)],
      [ticket("c1", "2026-09-01")],
      HOY,
    );
    expect(soloTicket.procedencia).toBeNull();
    expect(sinDato.procedencia).toBeNull();
  });

  it("las ops quedan ordenadas y primera/última/antigüedad salen de ahí", () => {
    const [c] = clientesIntel(
      [cliente("c1")],
      [venta("c1", "2026-07-01", 100), venta("c1", "2026-05-01", 100)],
      [ticket("c1", "2026-06-01", 80)],
      HOY,
    );
    expect(c.ops.map((o) => o.fechaISO)).toEqual(["2026-05-01", "2026-06-01", "2026-07-01"]);
    expect(c.primeraISO).toBe("2026-05-01");
    expect(c.primeraTipo).toBe("venta");
    expect(c.primeraMontoUsd).toBe(100);
    expect(c.ultimaISO).toBe("2026-07-01");
    expect(c.antiguedadDias).toBeGreaterThan(0);
    expect(c.diasSinActividad).toBeGreaterThan(0);
  });

  it("ventana de activo: 89 días atrás activo, 90 no", () => {
    const [a, b] = clientesIntel(
      [cliente("c1"), cliente("c2")],
      [venta("c1", "2026-06-28", 100), venta("c2", "2026-06-27", 100)],
      [],
      HOY,
    );
    expect(a.activo).toBe(true); // 89 días
    expect(b.activo).toBe(false); // 90 días
  });

  it("ventana de riesgo: 179 días ni activo ni en riesgo, 180 en riesgo", () => {
    const [a, b] = clientesIntel(
      [cliente("c1"), cliente("c2")],
      [venta("c1", "2026-03-30", 100), venta("c2", "2026-03-29", 100)],
      [],
      HOY,
    );
    expect(a.activo).toBe(false);
    expect(a.enRiesgo).toBe(false); // 179 días
    expect(b.enRiesgo).toBe(true); // 180 días
  });

  it("cliente sin operaciones no está ni activo ni en riesgo", () => {
    const [c] = clientesIntel([cliente("c1")], [], [], HOY);
    expect(c.activo).toBe(false);
    expect(c.enRiesgo).toBe(false);
    expect(c.primeraISO).toBeNull();
  });
});

describe("kpisClientes", () => {
  it("activos con delta contra la ventana previa", () => {
    // 3 activos ahora (ops < 90 días); 1 activo en la ventana previa
    const intel = clientesIntel(
      [cliente("c1"), cliente("c2"), cliente("c3"), cliente("c4")],
      [
        venta("c1", "2026-09-01", 100),
        venta("c2", "2026-09-02", 100),
        venta("c3", "2026-09-03", 100),
        venta("c4", "2026-06-01", 100), // ventana previa
      ],
      [],
      HOY,
    );
    const k = kpisClientes(intel, HOY);
    expect(k.activos).toBe(3);
    expect(k.deltaActivos).toBeCloseTo(200); // (3-1)/1
  });

  it("sin activos previos el delta es null (no hay contra quién comparar)", () => {
    const intel = clientesIntel(
      [cliente("c1")],
      [venta("c1", "2026-09-01", 100)],
      [],
      HOY,
    );
    expect(kpisClientes(intel, HOY).deltaActivos).toBeNull();
  });

  it("valor promedio = gasto (ventas) de la ventana ÷ activos", () => {
    const intel = clientesIntel(
      [cliente("c1"), cliente("c2")],
      [venta("c1", "2026-09-01", 300), venta("c2", "2026-09-01", 100)],
      [ticket("c1", "2026-09-20", 999)], // ticket: activo pero no gasto
      HOY,
    );
    const k = kpisClientes(intel, HOY);
    expect(k.activos).toBe(2);
    expect(k.valorPromedio).toBe(200); // (300+100)/2
  });

  it("tasa de recurrencia: ≥2 ops sobre los que tienen ≥1 (sin ops fuera del denominador)", () => {
    const intel = clientesIntel(
      [cliente("c1"), cliente("c2"), cliente("c3"), cliente("c4")], // c4 sin ops
      [
        venta("c1", "2026-09-01", 100),
        venta("c1", "2026-09-02", 100), // 2 ops
        venta("c2", "2026-09-01", 100), // 1 op
      ],
      [ticket("c3", "2026-09-01")], // 1 op
      HOY,
    );
    const k = kpisClientes(intel, HOY);
    expect(k.tasaRecurrencia).toBeCloseTo(100 / 3); // 1 de 3 con operaciones
  });

  it("en riesgo y el gasto histórico que representan", () => {
    const intel = clientesIntel(
      [cliente("c1"), cliente("c2")],
      [venta("c1", "2026-03-01", 250), venta("c2", "2026-09-01", 999)],
      [],
      HOY,
    );
    const k = kpisClientes(intel, HOY);
    expect(k.enRiesgo).toBe(1);
    expect(k.riesgoValorUsd).toBe(250);
  });
});

describe("cohortes", () => {
  it("M0 es 100% y la retención cuenta actividad (compra o reparación) por mes", () => {
    const intel = clientesIntel(
      [cliente("c1"), cliente("c2"), cliente("c3")],
      [
        venta("c1", "2026-07-05", 100), // cohorte jul
        venta("c1", "2026-08-20", 100), // c1 vuelve en M1
        venta("c2", "2026-07-10", 100), // cohorte jul
        venta("c3", "2026-09-01", 100), // cohorte sep (mes actual)
      ],
      [],
      HOY,
    );
    const filas = cohortesClientes(intel, HOY);
    const jul = filas.find((f) => f.key === "2026-07");
    expect(jul?.iniciales).toBe(2);
    expect(jul?.celdas[0]).toEqual({ retornaron: 2, pct: 100 });
    expect(jul?.celdas[1]).toEqual({ retornaron: 1, pct: 50 }); // c1 en M1
    const sep = filas.find((f) => f.key === "2026-09");
    expect(sep?.celdas[1].pct).toBeNull(); // M1 de la cohorte actual todavía no llegó
  });

  it("los meses que todavía no llegaron van en null", () => {
    const intel = clientesIntel([cliente("c1")], [venta("c1", "2026-09-01", 100)], [], HOY);
    const [fila] = cohortesClientes(intel, HOY);
    expect(fila.celdas.map((c) => c.pct)).toEqual([100, null, null, null, null, null, null]);
  });

  it("recorta los meses sin cohortes del principio y cruza fin de año", () => {
    const intel = clientesIntel([cliente("c1")], [venta("c1", "2025-12-15", 100)], [], HOY);
    // 7 filas: mar..sep 26 — la cohorte dic 25 quedó fuera del rango
    const filas = cohortesClientes(intel, HOY);
    expect(filas[0].key).toBe("2026-03");
    expect(filas.at(-1)?.key).toBe("2026-09");
    expect(sumaMeses("2025-12", 1)).toBe("2026-01");
    expect(mesCorto("2026-01")).toBe("ene 26");
  });

  it("clientesDeCelda devuelve los de la cohorte que operaron ese mes", () => {
    const intel = clientesIntel(
      [cliente("c1"), cliente("c2")],
      [
        venta("c1", "2026-07-05", 100),
        venta("c1", "2026-08-20", 100),
        venta("c2", "2026-07-10", 100),
      ],
      [],
      HOY,
    );
    const vuelven = clientesDeCelda(intel, "2026-07", 1);
    expect(vuelven.map((c) => c.id)).toEqual(["c1"]);
    expect(clientesDeCelda(intel, "2026-07", 0).map((c) => c.id).sort()).toEqual(["c1", "c2"]);
  });
});

describe("flujoClientes (lifecycle)", () => {
  it("clasifica por tipo de 1ª y 2ª op, mix final y conserva las cantidades", () => {
    // c1: venta, venta, ticket → recurrente mixto (1ª y 2ª compra)
    // c2: ticket, venta → segunda compra, no recurrente (cross-sell reparación→compra)
    // c3: venta → solo primera
    // c4: ticket, ticket, ticket → recurrente solo reparaciones
    // c5: venta, ticket → segunda reparación, no recurrente
    const intel = clientesIntel(
      ["c1", "c2", "c3", "c4", "c5"].map(cliente),
      [
        venta("c1", "2026-05-01", 100),
        venta("c1", "2026-05-02", 100),
        venta("c3", "2026-05-03", 100),
        venta("c5", "2026-05-04", 100),
        venta("c2", "2026-06-01", 100),
      ],
      [
        ticket("c1", "2026-05-05"),
        ticket("c2", "2026-05-01"),
        ticket("c4", "2026-05-01"),
        ticket("c4", "2026-05-02"),
        ticket("c4", "2026-05-03"),
        ticket("c5", "2026-05-06"),
      ],
      HOY,
    );
    const f = flujoClientes(intel);
    expect(f.primera).toEqual({ compra: 3, reparacion: 2 }); // c1,c3,c5 compra; c2,c4 reparación
    expect(f.segunda).toEqual({ compra: 2, reparacion: 2 }); // c1,c2 compra; c4,c5 reparación
    expect(f.recurrentes).toEqual({ soloCompras: 0, soloReparaciones: 1, mixtos: 1 });
    expect(f.conOperaciones).toBe(5);
    // el cross-sell queda explícito: c2 empezó por reparación y su 2ª fue compra
    expect(f.flujosPrimera).toContainEqual({ de: "ticket", a: "venta", clientes: 1 });
  });

  it("los flujos primera→segunda reflejan el cambio de tipo", () => {
    const intel = clientesIntel(
      [cliente("c1"), cliente("c2")],
      [venta("c1", "2026-05-01", 100), venta("c1", "2026-05-02", 100)],
      [ticket("c2", "2026-05-01"), ticket("c2", "2026-05-02")],
      HOY,
    );
    const f = flujoClientes(intel);
    expect(f.flujosPrimera).toContainEqual({ de: "venta", a: "venta", clientes: 1 });
    expect(f.flujosPrimera).toContainEqual({ de: "ticket", a: "ticket", clientes: 1 });
    expect(f.flujosPrimera).not.toContainEqual({ de: "venta", a: "ticket", clientes: 1 });
  });

  it("inactivos por etapa alcanzada y en curso cierran la conservación", () => {
    // c1: 1 op vieja (inactivo en primera); c2: 1 op reciente (en curso);
    // c3: 2 ops viejas (inactivo en segunda, no recurrente); c4: 3 ops recientes
    const intel = clientesIntel(
      [cliente("c1"), cliente("c2"), cliente("c3"), cliente("c4")],
      [
        venta("c1", "2026-01-05", 100),
        venta("c2", "2026-09-20", 100),
        venta("c3", "2026-01-05", 100),
        venta("c3", "2026-01-06", 100),
        venta("c4", "2026-09-10", 100),
        venta("c4", "2026-09-11", 100),
        venta("c4", "2026-09-12", 100),
      ],
      [],
      HOY,
    );
    const f = flujoClientes(intel);
    expect(f.inactivos).toEqual([
      { etapa: "primera", clientes: 1 },
      { etapa: "segunda", clientes: 1 },
      { etapa: "recurrentes", clientes: 0 },
    ]);
    expect(f.enCurso).toBe(1); // c2: paró en primera pero sigue dentro de la ventana
    // conservación: primera = segunda + caídos en primera (inactivos + en curso ahí)
    const totalPrimera = f.primera.compra + f.primera.reparacion;
    const totalSegunda = f.segunda.compra + f.segunda.reparacion;
    const enCursoPrimera = totalPrimera - totalSegunda - f.inactivos[0].clientes;
    expect(enCursoPrimera).toBe(1); // c2
    expect(totalPrimera).toBe(totalSegunda + f.inactivos[0].clientes + enCursoPrimera);
    // y en segunda: recurrentes + inactivos de segunda + parados recientes
    const totalRecurrentes =
      f.recurrentes.soloCompras + f.recurrentes.soloReparaciones + f.recurrentes.mixtos;
    const paradosEnSegunda = totalSegunda - totalRecurrentes - f.inactivos[1].clientes;
    expect(paradosEnSegunda).toBe(0); // c3 quedó inactivo, nadie pendiente
  });

  it("MIN_OPS_RECURRENTE separa la etapa recurrente de la segunda", () => {
    expect(MIN_OPS_RECURRENTE).toBe(3);
    const intel = clientesIntel(
      [cliente("c1"), cliente("c2")],
      [venta("c1", "2026-09-01", 100), venta("c1", "2026-09-02", 100)],
      [ticket("c2", "2026-09-01"), ticket("c2", "2026-09-02"), ticket("c2", "2026-09-03")],
      HOY,
    );
    const f = flujoClientes(intel);
    expect(f.segunda).toEqual({ compra: 1, reparacion: 1 });
    expect(f.recurrentes).toEqual({ soloCompras: 0, soloReparaciones: 1, mixtos: 0 });
  });
});

describe("procedenciaRanking", () => {
  it("agrupa clientes y valor por canal, con 'Sin dato' para los sin procedencia", () => {
    const intel = clientesIntel(
      [cliente("c1"), cliente("c2"), cliente("c3")],
      [
        venta("c1", "2026-09-01", 300, "Instagram"),
        venta("c2", "2026-09-01", 100, "Instagram"),
        venta("c3", "2026-09-01", 50),
      ],
      [],
      HOY,
    );
    const rows = procedenciaRanking(intel);
    expect(rows[0]).toEqual({
      label: "Instagram",
      clientes: 2,
      pct: (2 / 3) * 100,
      valorUsd: 400,
    });
    expect(rows[1].label).toBe(SIN_PROCEDENCIA);
    expect(rows[1].clientes).toBe(1);
  });
});

describe("ingresosPorMesClientes", () => {
  it("separa el aporte de clientes nuevos (primera op ese mes) del de existentes", () => {
    const intel = clientesIntel(
      [cliente("c1"), cliente("c2")],
      [
        venta("c1", "2026-08-01", 100), // primera op de c1 en ago → nuevo en ago
        venta("c1", "2026-09-01", 200), // c1 ya existente en sep
        venta("c2", "2026-09-02", 50), // primera de c2 en sep → nuevo en sep
      ],
      [ticket("c1", "2026-09-03", 70)], // c1 existente en sep (reparación)
      HOY,
    );
    const rows = ingresosPorMesClientes(
      [
        venta("c1", "2026-08-01", 100),
        venta("c1", "2026-09-01", 200),
        venta("c2", "2026-09-02", 50),
      ],
      [ticket("c1", "2026-09-03", 70)],
      intel,
      HOY,
    );
    const ago = rows.find((r) => r.key === "2026-08");
    const sep = rows.find((r) => r.key === "2026-09");
    expect(ago?.comprasNuevos).toBe(100);
    expect(ago?.comprasExistentes).toBe(0);
    expect(sep?.comprasNuevos).toBe(50); // c2
    expect(sep?.comprasExistentes).toBe(200); // c1
    expect(sep?.reparacionesExistentes).toBe(70);
    expect(sep?.totalNuevos).toBe(50);
    expect(sep?.totalExistentes).toBe(270);
    expect(sep?.total).toBe(320);
  });

  it("completa los meses sin actividad en 0 y no inventa meses futuros", () => {
    // primera actividad en jul: el rango arranca ahí (nada antes), con ago vacío
    const intel = clientesIntel(
      [cliente("c1")],
      [venta("c1", "2026-07-01", 100), venta("c1", "2026-09-01", 100)],
      [],
      HOY,
    );
    const rows = ingresosPorMesClientes(
      [venta("c1", "2026-07-01", 100), venta("c1", "2026-09-01", 100)],
      [],
      intel,
      HOY,
      12,
    );
    expect(rows.map((r) => r.key)).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(rows[1].total).toBe(0); // ago sin actividad, en 0
    expect(rows.at(-1)?.total).toBe(100);
  });

  it("tope de `meses`: lo más viejo queda fuera del rango", () => {
    const v1 = venta("c1", "2026-01-01", 100);
    const v2 = venta("c1", "2026-09-01", 100);
    const intel = clientesIntel([cliente("c1")], [v1, v2], [], HOY);
    const rows = ingresosPorMesClientes([v1, v2], [], intel, HOY, 4);
    expect(rows.map((r) => r.key)).toEqual(["2026-06", "2026-07", "2026-08", "2026-09"]);
  });

  it("ventas de clientes desconocidos (baja lógica) cuentan como existentes", () => {
    const rows = ingresosPorMesClientes([venta("zzz", "2026-09-01", 80)], [], [], HOY, 2);
    const sep = rows.find((r) => r.key === "2026-09");
    expect(sep?.comprasExistentes).toBe(80);
    expect(sep?.comprasNuevos).toBe(0);
  });
});

describe("constantes de definición", () => {
  it("las ventanas quedan explícitas y coherentes entre sí", () => {
    expect(DIAS_ACTIVO).toBe(90);
    expect(DIAS_RIESGO).toBe(180);
    expect(DIAS_RIESGO).toBeGreaterThanOrEqual(DIAS_ACTIVO);
  });
});
