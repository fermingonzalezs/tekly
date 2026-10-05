import { describe, expect, it } from "vitest";
import {
  metricasDashboard,
  metricasEmpleado,
  objetivoDelMes,
  ticketsDeTecnico,
  tiempoRelativo,
  fechaCorta,
  ventaGananciaPorPeriodo,
  ventasPorRubro,
  ventasRecientes,
} from "@/lib/dashboard";
import type { Ticket, Turno, Venta, VentaItem } from "@/lib/types";

function venta(fechaISO: string, totalUsd: number, margenPct = 20, extra?: Partial<Venta>): Venta {
  return {
    id: "V-1",
    fecha: "",
    fechaISO,
    clienteId: "",
    cliente: "Cliente",
    vendedorId: "",
    vendedor: "Vendedor",
    items: [{ detalle: "Item", cantidad: 1, precioUsd: totalUsd }],
    totalUsd,
    pagos: [],
    margenPct,
    tipo: "venta",
    modalidad: "minorista",
    ...extra,
  };
}

function ticket(fechaISO: string, extra?: Partial<Ticket>): Ticket {
  return {
    id: 1,
    clienteId: "",
    cliente: "Cliente",
    equipo: "iPhone 13",
    imei: "",
    falla: "Pantalla",
    tecnicoId: null,
    tecnico: null,
    estado: "recibido",
    ingreso: "",
    fechaISO,
    presupuestoUsd: 0,
    servicios: [],
    ...extra,
  };
}

function turno(dayOffset: number, extra?: Partial<Turno>): Turno {
  return {
    id: "t-1",
    dayOffset,
    hora: "10:00",
    cliente: "Cliente",
    clienteId: "",
    tipo: "deja",
    estado: "pendiente",
    ticketId: null,
    ...extra,
  };
}

describe("metricasDashboard", () => {
  it("calcula ventas/margen/ticket del mes y delta vs mes anterior", () => {
    const hoy = new Date(2026, 8, 14); // 14 sep 2026
    const ventas = [venta("2026-09-05", 100, 20), venta("2026-08-05", 50, 10)];
    const out = metricasDashboard({ ventas, ticketsAbiertos: 3, turnosHoy: 2, hoy });
    const porKey = Object.fromEntries(out.map((m) => [m.key, m]));
    expect(porKey.ventas.value).toBe("U$ 100");
    expect(porKey.ventas.delta).toBe(100); // 100 vs 50 = +100%
    expect(porKey.ventas.destacada).toBe(true);
    expect(porKey.abiertos.value).toBe("3");
    expect(porKey.turnos.value).toBe("2");
  });

  it("conteos puntuales sin delta (no fabrica un '+0.0%')", () => {
    const hoy = new Date(2026, 8, 14);
    const out = metricasDashboard({ ventas: [], ticketsAbiertos: 3, turnosHoy: 2, hoy });
    const porKey = Object.fromEntries(out.map((m) => [m.key, m]));
    expect(porKey.abiertos.delta).toBeUndefined();
    expect(porKey.turnos.delta).toBeUndefined();
  });

  it("sin ventas del mes anterior, delta 0 (no fabrica una comparación)", () => {
    const hoy = new Date(2026, 8, 14);
    const out = metricasDashboard({ ventas: [venta("2026-09-05", 100)], ticketsAbiertos: 0, turnosHoy: 0, hoy });
    expect(out.find((m) => m.key === "ventas")!.delta).toBe(0);
  });

  it("margen ponderado por facturación (solo ítems con costo), '—' si no hay ninguno", () => {
    const hoy = new Date(2026, 8, 14);
    // 2 ventas del mes: 100 facturado con costo 50 (50%) y 20 sin costo.
    // Ponderado: (100-50) / 100 = 50% -- el ítem sin costo no infla el margen.
    const ventas = [
      venta("2026-09-05", 100, 20, {
        items: [{ detalle: "Item", cantidad: 1, precioUsd: 100, costoUsd: 50 }],
      }),
      venta("2026-09-06", 20, 20, {
        items: [{ detalle: "Item", cantidad: 1, precioUsd: 20 }],
      }),
      venta("2026-08-05", 50, 20, {
        items: [{ detalle: "Item", cantidad: 1, precioUsd: 50, costoUsd: 40 }],
      }),
    ];
    const out = metricasDashboard({ ventas, ticketsAbiertos: 0, turnosHoy: 0, hoy });
    const porKey = Object.fromEntries(out.map((m) => [m.key, m]));
    expect(porKey.margen.value).toBe("50.0 %");
    expect(porKey.margen.delta).toBe(30); // 50% vs 20% del mes anterior
  });

  it("margen '—' y sin delta si ningún ítem tiene costo cargado", () => {
    const hoy = new Date(2026, 8, 14);
    const out = metricasDashboard({ ventas: [venta("2026-09-05", 100)], ticketsAbiertos: 0, turnosHoy: 0, hoy });
    const porKey = Object.fromEntries(out.map((m) => [m.key, m]));
    expect(porKey.margen.value).toBe("—");
    expect(porKey.margen.delta).toBeUndefined();
  });
});

describe("metricasEmpleado", () => {
  it("vendedor: solo sus ventas, y 'listos para retirar' de toda la org", () => {
    const hoy = new Date(2026, 9, 7); // 7 oct 2026
    const ventas = [
      venta("2026-10-05", 100, 20, { vendedorId: "yo", id: "V-1" }),
      venta("2026-10-06", 60, 20, { vendedorId: "otro", id: "V-2" }),
      venta("2026-09-20", 50, 20, { vendedorId: "yo", id: "V-3" }),
    ];
    const tickets = [
      ticket("2026-10-01", { estado: "listo" }),
      ticket("2026-10-01", { estado: "en_reparacion" }),
    ];
    const turnos = [turno(0), turno(0, { estado: "cancelado" }), turno(1)];
    const out = metricasEmpleado({ ventas, tickets, turnos, userId: "yo", rol: "vendedor", hoy });
    const porKey = Object.fromEntries(out.map((m) => [m.key, m]));
    expect(porKey["mis-ventas"].value).toBe("U$ 100"); // solo V-1, no la de "otro"
    expect(porKey["mis-ventas"].delta).toBe(100); // 100 vs 50 de sep
    expect(porKey["mis-ventas"].destacada).toBe(true);
    expect(porKey["mis-operaciones"].value).toBe("1");
    expect(porKey["listos-retirar"].value).toBe("1");
    expect(porKey.turnos.value).toBe("1"); // el cancelado no cuenta
  });

  it("técnico: solo sus tickets, listos de la semana (desde el lunes)", () => {
    const hoy = new Date(2026, 9, 7); // mié 7 oct 2026 -> lunes 5 oct
    const tickets = [
      ticket("2026-10-06", { estado: "listo", tecnicoId: "yo", id: 11 }),
      ticket("2026-09-20", { estado: "listo", tecnicoId: "yo", id: 12 }), // la semana pasada
      ticket("2026-10-06", { estado: "listo", tecnicoId: "otro", id: 13 }),
      ticket("2026-10-05", { estado: "esperando_repuesto", tecnicoId: "yo", id: 14 }),
      ticket("2026-10-04", { estado: "recibido", tecnicoId: "yo", id: 15 }),
      ticket("2026-10-01", { estado: "entregado", tecnicoId: "yo", id: 16 }),
    ];
    const out = metricasEmpleado({ ventas: [], tickets, turnos: [], userId: "yo", rol: "tecnico", hoy });
    const porKey = Object.fromEntries(out.map((m) => [m.key, m]));
    expect(porKey["mis-abiertos"].value).toBe("4"); // 11, 12, 14 y 15 (el 16 está entregado)
    expect(porKey["esperando-repuesto"].value).toBe("1");
    expect(porKey["listos-semana"].value).toBe("1"); // solo el 11 (ingreso 6 oct); el 12 es de la semana pasada
    expect(porKey.turnos.value).toBe("0");
  });
});

describe("ticketsDeTecnico", () => {
  it("solo propios sin entregar, por estado (TICKET_FLOW) y luego ingreso reciente, máx 8", () => {
    const tickets = [
      ticket("2026-10-01", { tecnicoId: "yo", estado: "en_reparacion", id: 21 }),
      ticket("2026-10-05", { tecnicoId: "yo", estado: "recibido", id: 22 }),
      ticket("2026-10-02", { tecnicoId: "yo", estado: "recibido", id: 23 }),
      ticket("2026-10-06", { tecnicoId: "yo", estado: "entregado", id: 24 }),
      ticket("2026-10-06", { tecnicoId: "otro", estado: "listo", id: 25 }),
    ];
    const out = ticketsDeTecnico(tickets, "yo");
    // recibido va antes que en_reparacion en TICKET_FLOW; dentro de recibido, más reciente primero
    expect(out.map((t) => t.id)).toEqual([22, 23, 21]);
    expect(out[0]).toEqual({ id: 22, equipo: "iPhone 13", estado: "recibido" });
  });
});

describe("tiempoRelativo / fechaCorta", () => {
  it("hoy / ayer / hace N d / fecha corta a partir del 7mo día", () => {
    const hoy = new Date(2026, 9, 14); // mié 14 oct
    expect(tiempoRelativo("2026-10-14", hoy)).toBe("hoy");
    expect(tiempoRelativo("2026-10-13", hoy)).toBe("ayer");
    expect(tiempoRelativo("2026-10-11", hoy)).toBe("hace 3 d");
    expect(tiempoRelativo("2026-10-04", hoy)).toBe("4 oct");
  });

  it("fechaCorta con día de semana correcto sin importar el huso", () => {
    // 2026-10-14 es miércoles
    expect(fechaCorta("2026-10-14")).toBe("mié 14 oct");
    expect(fechaCorta("2026-10-11")).toBe("dom 11 oct");
    expect(fechaCorta("2026-01-01")).toBe("jue 1 ene");
  });
});

describe("objetivoDelMes", () => {
  it("suma el mes en curso y el anterior por separado", () => {
    const hoy = new Date(2026, 8, 14);
    const ventas = [venta("2026-09-01", 100), venta("2026-09-10", 30), venta("2026-08-20", 80)];
    const out = objetivoDelMes(ventas, hoy);
    expect(out.current).toBe(130);
    expect(out.prevTotal).toBe(80);
    expect(out.prevMes).toBe("ago");
    expect(out.dayOfMonth).toBe(14);
    expect(out.daysInMonth).toBe(30);
  });
});

describe("ventaGananciaPorPeriodo", () => {
  it("'quince' trae 15 días terminando hoy, con fechas alineadas", () => {
    const hoy = new Date(2026, 8, 14);
    const ventas = [venta("2026-09-14", 200, 50)];
    const out = ventaGananciaPorPeriodo(ventas, hoy).quince;
    expect(out.venta).toHaveLength(15);
    expect(out.venta[14]).toBe(200);
    expect(out.ganancia[14]).toBe(100);
    expect(out.venta[0]).toBe(0);
    expect(out.fechas).toHaveLength(15);
    expect(out.fechas[14]).toBe("2026-09-14");
    expect(out.fechas[0]).toBe("2026-08-31");
  });

  it("'mes' trae del día 1 a hoy", () => {
    const hoy = new Date(2026, 8, 14);
    const out = ventaGananciaPorPeriodo([venta("2026-09-01", 100)], hoy).mes;
    expect(out.venta).toHaveLength(14);
    expect(out.venta[0]).toBe(100);
    expect(out.fechas[0]).toBe("2026-09-01");
  });

  it("'mesPrevio' trae el mes calendario anterior completo", () => {
    const hoy = new Date(2026, 8, 14);
    const out = ventaGananciaPorPeriodo([venta("2026-08-31", 100)], hoy).mesPrevio;
    expect(out.venta).toHaveLength(31);
    expect(out.venta[30]).toBe(100);
    expect(out.fechas[30]).toBe("2026-08-31");
  });
});

describe("ventasPorRubro", () => {
  function item(precioUsd: number, extra?: Partial<VentaItem>): VentaItem {
    return { detalle: "Item", cantidad: 1, precioUsd, ...extra };
  }
  function porLabel(out: { label: string; value: number }[]) {
    return Object.fromEntries(out.map((r) => [r.label, r.value]));
  }

  it("agrupa por categoría del ítem, sólo ventas del período", () => {
    const hoy = new Date(2026, 8, 14);
    const ventas: Venta[] = [
      venta("2026-09-05", 100, 20, {
        items: [
          item(60, { categoria: "equipo" }),
          item(40, { categoria: "otro" }),
        ],
      }),
      venta("2026-08-05", 999, 20, { items: [item(999, { categoria: "servicio" })] }),
    ];
    const mes = porLabel(ventasPorRubro(ventas, hoy).mes);
    expect(mes.Equipos).toBe(60);
    expect(mes.Accesorios).toBe(40);
    expect(mes.Reparaciones).toBe(0);
  });

  it("ítem sin categoria (venta anterior a este campo): equipoId -> Equipos, si no -> Otros", () => {
    const hoy = new Date(2026, 8, 14);
    const ventas: Venta[] = [
      venta("2026-09-05", 150, 20, {
        items: [item(90, { equipoId: "eq-1" }), item(60)],
      }),
    ];
    const mes = porLabel(ventasPorRubro(ventas, hoy).mes);
    expect(mes.Equipos).toBe(90);
    expect(mes.Otros).toBe(60);
  });
});

describe("ventasRecientes", () => {
  it("ordena por fecha descendente y calcula el tiempo relativo contra hoy", () => {
    const hoy = new Date(2026, 9, 10);
    const ventas = [
      venta("2026-10-01", 50, 20, { tipo: "reparacion", id: "V-9" }),
      venta("2026-10-10", 100, 20, { tipo: "venta", id: "V-8" }),
    ];
    const out = ventasRecientes(ventas, 8, hoy);
    expect(out[0].id).toBe("V-8");
    expect(out[0].monto).toBe(100);
    expect(out[0].hace).toBe("hoy");
    expect(out[1].hace).toBe("1 oct");
    expect(out[1].vendedor).toBe("Vendedor");
  });
});
