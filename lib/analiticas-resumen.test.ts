import { describe, expect, it } from "vitest";
import {
  resumenClientes,
  resumenFinanzas,
  resumenInventario,
  resumenReparaciones,
  resumenTurnos,
  resumenVentas,
  type ContextoAnaliticas,
} from "@/lib/analiticas-resumen";
import type {
  Caja,
  Cliente,
  MovimientoCaja,
  MovimientoCC,
  Repuesto,
  Ticket,
  Turno,
  Venta,
  VentaItem,
} from "@/lib/types";

const HOY = new Date(2026, 9, 4); // 4 oct 2026 (local)

function ctx(desde: string, hasta: string): ContextoAnaliticas {
  return { rango: { desde, hasta }, rangoAnterior: null, preset: "personalizado", hoy: HOY };
}

function venta(
  fechaISO: string,
  totalUsd: number,
  opts: { items?: VentaItem[]; vendedor?: string; pagos?: Venta["pagos"] } = {},
): Venta {
  return {
    id: "V-1",
    fecha: "",
    fechaISO,
    clienteId: "c1",
    cliente: "Caro",
    vendedorId: "u1",
    vendedor: opts.vendedor ?? "Ana",
    items: opts.items ?? [],
    totalUsd,
    pagos: opts.pagos ?? [],
    margenPct: 0,
    tipo: "venta",
    modalidad: "minorista",
  };
}

function caja(id: string, moneda: "ars" | "usd"): Caja {
  return {
    id,
    nombre: id,
    moneda,
    activa: true,
    descripcion: "",
    creadaEl: "ene 2026",
    medioPago: "pesos",
  };
}

function mov(
  fechaISO: string,
  tipo: "ingreso" | "egreso",
  monto: number,
  cajaId: string,
  extra: Partial<MovimientoCaja> = {},
): MovimientoCaja {
  return {
    id: `m-${fechaISO}-${monto}-${cajaId}`,
    fecha: "",
    fechaISO,
    hora: "12:00",
    concepto: "",
    medioPago: "pesos",
    tipo,
    categoria: null,
    cajaId,
    monto,
    cotizacion: null,
    ticketId: null,
    usuario: "Ana",
    conciliacionId: null,
    ...extra,
  };
}

describe("resumenVentas", () => {
  it("filtra por rango y calcula KPIs", () => {
    const ventas = [
      venta("2026-10-01", 100),
      venta("2026-10-03", 300),
      venta("2026-09-30", 999), // fuera
    ];
    const r = resumenVentas(ventas, ctx("2026-10-01", "2026-10-04"));
    expect(r.operaciones).toBe(2);
    expect(r.facturacion).toBe(400);
    expect(r.ticketPromedio).toBe(200);
  });

  it("margen = margenPonderado (mismo criterio que Ganancia por categoría)", () => {
    const ventas = [
      venta("2026-10-01", 1000, {
        items: [{ detalle: "A", cantidad: 1, precioUsd: 1000, costoUsd: 600 }],
      }),
    ];
    const r = resumenVentas(ventas, ctx("2026-10-01", "2026-10-04"));
    expect(r.margenPct).toBeCloseTo(40, 5);
  });

  it("sin costos cargados el margen es null", () => {
    const ventas = [
      venta("2026-10-01", 100, { items: [{ detalle: "A", cantidad: 1, precioUsd: 100 }] }),
    ];
    expect(resumenVentas(ventas, ctx("2026-10-01", "2026-10-04")).margenPct).toBeNull();
  });

  it("rankea vendedores con monto, operaciones y % del total", () => {
    const ventas = [
      venta("2026-10-01", 100, { vendedor: "Ana" }),
      venta("2026-10-02", 300, { vendedor: "Beto" }),
      venta("2026-10-03", 100, { vendedor: "Ana" }),
    ];
    const r = resumenVentas(ventas, ctx("2026-10-01", "2026-10-04"));
    expect(r.porVendedor.map((v) => v.label)).toEqual(["Beto", "Ana"]);
    expect(r.porVendedor[0]).toMatchObject({ value: 300, operaciones: 1 });
    expect(r.porVendedor[1]).toMatchObject({ value: 200, operaciones: 2 });
    expect(r.porVendedor[0].pct).toBeCloseTo(60, 1);
  });

  it("porDiaSemana grafica el promedio (no el total) y respeta el rango", () => {
    // 2026-10-03 es sábado; 2026-10-04 domingo.
    const ventas = [venta("2026-10-03", 100), venta("2026-10-04", 100)];
    const r = resumenVentas(ventas, ctx("2026-10-03", "2026-10-04"));
    const sabado = r.porDiaSemana.find((d) => d.dia === "Sáb")!;
    expect(sabado.promedioUsd).toBe(100);
    expect(sabado.usd).toBe(100);
  });

  it("deltas contra el período anterior", () => {
    const ventas = [
      venta("2026-10-01", 200),
      venta("2026-09-01", 100),
    ];
    const c: ContextoAnaliticas = {
      rango: { desde: "2026-10-01", hasta: "2026-10-04" },
      rangoAnterior: { desde: "2026-09-01", hasta: "2026-09-04" },
      preset: "personalizado",
      hoy: HOY,
    };
    expect(resumenVentas(ventas, c).deltas.facturacion).toBe(100);
  });
});

describe("resumenReparaciones", () => {
  const cajaUsd = caja("c-usd", "usd");

  it("KPI Cobrado usa los pagos con ticketId, no los presupuestos de tickets creados", () => {
    const tickets: Ticket[] = [
      { id: 1, clienteId: "c1", cliente: "", equipo: "", imei: "", falla: "", tecnicoId: null, tecnico: null, estado: "entregado", ingreso: "", fechaISO: "2026-10-01", presupuestoUsd: 9999, servicios: [] },
      { id: 2, clienteId: "c1", cliente: "", equipo: "", imei: "", falla: "", tecnicoId: null, tecnico: null, estado: "recibido", ingreso: "", fechaISO: "2026-10-02", presupuestoUsd: 5000, servicios: [] },
    ];
    const movsCaja = [
      mov("2026-10-02", "ingreso", 120, "c-usd", { ticketId: 1 }),
      mov("2026-10-02", "ingreso", 50, "c-usd"), // sin ticket: no cuenta
    ];
    const r = resumenReparaciones(tickets, movsCaja, [], [cajaUsd], [], ctx("2026-10-01", "2026-10-04"), []);
    expect(r.cobrado.totalUsd).toBe(120);
    expect(r.cantidad).toBe(2);
  });

  it("incluye cargos a cuenta corriente y lo informa", () => {
    const movsCC: MovimientoCC[] = [
      { id: "cc1", clienteId: "c1", fecha: "", fechaISO: "2026-10-02", hora: "12:00", concepto: "", tipo: "cargo", montoUsd: 80, ticketId: 1, usuario: "Ana" },
    ];
    const r = resumenReparaciones([], [], movsCC, [], [], ctx("2026-10-01", "2026-10-04"), []);
    expect(r.cobrado.ccUsd).toBe(80);
    expect(r.cobrado.totalUsd).toBe(80);
  });

  it("gasto de repuestos solo sobre tickets cobrados", () => {
    const repuestos: Repuesto[] = [
      { id: "r1", sku: "", nombre: "Pantalla", modelo: "", stock: 5, stockMin: 1, costoUsd: 30, proveedor: "" },
    ];
    const ticket: Ticket = {
      id: 1, clienteId: "c1", cliente: "", equipo: "", imei: "", falla: "", tecnicoId: null, tecnico: null,
      estado: "entregado", ingreso: "", fechaISO: "2026-10-01", presupuestoUsd: 100,
      servicios: [{ origen: "repuesto", repuestoId: "r1", nombre: "Pantalla", precioUsd: 100, cantidad: 2 }],
    };
    const movsCaja = [mov("2026-10-02", "ingreso", 100, "c-usd", { ticketId: 1 })];
    const r = resumenReparaciones([ticket], movsCaja, [], [cajaUsd], repuestos, ctx("2026-10-01", "2026-10-04"), []);
    expect(r.gastoRepuestos).toBe(60);
    expect(r.gananciaFinal).toBe(40);
  });
});

describe("resumenFinanzas", () => {
  it("convierte pesos con la cotización guardada, nunca con el blue de hoy", () => {
    const cajaArs = caja("c-ars", "ars");
    const movs = [
      mov("2026-10-02", "ingreso", 146500, "c-ars", { cotizacion: 1465 }),
      mov("2026-10-02", "egreso", 100, "c-usd"),
    ];
    const cajaUsd = caja("c-usd", "usd");
    const r = resumenFinanzas([], movs, [cajaArs, cajaUsd], [], ctx("2026-10-01", "2026-10-04"));
    expect(r.ingresosUsd).toBeCloseTo(100, 5);
    expect(r.egresosUsd).toBe(100);
    expect(r.netoUsd).toBeCloseTo(0, 5);
  });

  it("informa en pesos los movimientos sin cotización sin sumarlos", () => {
    const cajaArs = caja("c-ars", "ars");
    const movs = [
      mov("2026-10-02", "ingreso", 50000, "c-ars"), // sin cotización
      mov("2026-10-02", "egreso", 30000, "c-ars"), // sin cotización
    ];
    const r = resumenFinanzas([], movs, [cajaArs], [], ctx("2026-10-01", "2026-10-04"));
    expect(r.ingresosUsd).toBe(0);
    expect(r.egresosUsd).toBe(0);
    expect(r.sinCotizacion).toEqual({ cantidad: 2, ingresosArs: 50000, egresosArs: 30000 });
  });
});

describe("resumenInventario", () => {
  it("KPI de stock no depende del rango pero el flujo sí", () => {
    const equipoBase = {
      id: "e1", modelo: "iPhone 13", almacenamiento: "128", color: "Negro",
      imei: "", bateria: 90, condicion: "A+", costoUsd: 500, precioUsd: 800,
      estado: "disponible" as const,
    };
    const ventas = [
      venta("2026-10-02", 800, {
        items: [{ detalle: "iPhone", cantidad: 1, precioUsd: 800, categoria: "equipo" }],
      }),
    ];
    const r = resumenInventario(
      [equipoBase], [], [], [], ventas, [], ctx("2026-10-01", "2026-10-04"),
    );
    expect(r.unidadesStock).toBe(1);
    expect(r.valorInventario).toBe(500);
    expect(r.salidas.equipo).toBe(1);
    // Fuera del rango: no cuenta como salida del período.
    const r2 = resumenInventario(
      [equipoBase], [], [], [], ventas, [], ctx("2026-09-01", "2026-09-30"),
    );
    expect(r2.salidas.equipo).toBe(0);
    expect(r2.unidadesStock).toBe(1);
  });
});

describe("resumenClientes", () => {
  it("calcula kpis/intel/ranking desde clientes+ventas+tickets", () => {
    const clientes: Cliente[] = [
      { id: "c1", nombre: "Caro", telefono: "", email: "", desde: "", compras: 0, reparaciones: 0, gastadoUsd: 0 },
    ];
    const ventas = [venta("2026-09-01", 500, { pagos: [] })];
    const r = resumenClientes(clientes, ventas, [], ctx("2026-10-01", "2026-10-04"));
    expect(r.intel).toHaveLength(1);
    expect(r.kpis.total).toBe(1);
    expect(r.ranking.length).toBeGreaterThan(0);
  });
});

describe("resumenTurnos", () => {
  function turno(estado: Turno["estado"], dayOffset: number): Turno {
    return {
      id: `t-${estado}-${dayOffset}`, dayOffset, hora: "10:00", cliente: "",
      clienteId: null, tipo: "deja", estado, ticketId: null,
    };
  }
  it("no inventa 'asistió' y cuenta sin-confirmar ya pasados", () => {
    const turnos = [turno("confirmado", -1), turno("pendiente", -2), turno("pendiente", 2), turno("cancelado", 0)];
    const r = resumenTurnos(turnos);
    expect(r.total).toBe(4);
    expect(r.confirmados).toBe(1);
    expect(r.cancelados).toBe(1);
    expect(r.sinConfirmarPasados).toBe(1);
    expect(r.porEstado).toHaveLength(3);
  });
});
