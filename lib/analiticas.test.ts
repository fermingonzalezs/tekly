import { describe, expect, it } from "vitest";
import {
  ventasPorMes,
  facturacionDiaria,
  margenPorTipo,
  rentabilidadPorMes,
  ventasPorRubroMes,
  ventasPorDiaSemana,
  ventasBrutasPorFalla,
  antiguedadTicketsAbiertos,
  ticketsPorDiaSemana,
  funnelTickets,
  tasaAceptacion,
  stockItems,
  agingBuckets,
  diasInventarioEquipos,
  unidadesDeMovimiento,
  movimientoEnUsd,
  sinCotizacion,
  cobradoReparaciones,
} from "@/lib/analiticas";
import { margenPonderado } from "@/lib/ventas";
import type {
  Venta,
  VentaItem,
  Ticket,
  Equipo,
  Repuesto,
  OtroItem,
  Caja,
  MovimientoCaja,
  MovimientoCC,
} from "@/lib/types";
import type { MovimientoStockBulk } from "@/lib/db/inventario";

function venta(fechaISO: string, totalUsd: number, items: VentaItem[] = []): Venta {
  return {
    id: "V-1",
    fecha: "",
    fechaISO,
    clienteId: "",
    cliente: "",
    vendedorId: "",
    vendedor: "",
    items,
    totalUsd,
    pagos: [],
    margenPct: 0,
    tipo: "venta",
    modalidad: "minorista",
  };
}

describe("ventasPorMes", () => {
  it("agrupa por mes y completa los meses sin ventas con 0", () => {
    const hoy = new Date(2026, 8, 14); // 14 sep 2026
    const ventas = [venta("2026-09-05", 100), venta("2026-08-01", 50)];
    const out = ventasPorMes(ventas, 3, hoy);
    expect(out).toEqual([
      { mes: "jul", usd: 0 },
      { mes: "ago", usd: 50 },
      { mes: "sep", usd: 100 },
    ]);
  });

  it("suma varias ventas del mismo mes", () => {
    const hoy = new Date(2026, 8, 14);
    const ventas = [venta("2026-09-01", 100), venta("2026-09-20", 30)];
    const out = ventasPorMes(ventas, 1, hoy);
    expect(out).toEqual([{ mes: "sep", usd: 130 }]);
  });
});

describe("facturacionDiaria", () => {
  it("devuelve un array de `dias` posiciones, oldest-first", () => {
    const hoy = new Date(2026, 8, 14);
    const ventas = [venta("2026-09-14", 200), venta("2026-09-12", 80)];
    const out = facturacionDiaria(ventas, 3, hoy);
    expect(out).toEqual([80, 0, 200]);
  });

  it("sin ventas da todos ceros", () => {
    expect(facturacionDiaria([], 3, new Date(2026, 8, 14))).toEqual([0, 0, 0]);
  });
});

describe("margenPorTipo", () => {
  it("calcula operaciones, ganancia y margen por rubro", () => {
    const ventas = [
      venta("2026-09-01", 900, [
        { detalle: "iPhone 13", cantidad: 1, precioUsd: 450, costoUsd: 300, categoria: "equipo" },
        { detalle: "Cambio pantalla", cantidad: 1, precioUsd: 100, costoUsd: 40, categoria: "servicio" },
      ]),
      venta("2026-09-02", 450, [
        { detalle: "iPhone 12", cantidad: 1, precioUsd: 450, costoUsd: 350, categoria: "equipo" },
      ]),
    ];
    const out = margenPorTipo(ventas);
    expect(out).toEqual([
      { tipo: "Equipos", operaciones: 2, margenPct: 27.8, gananciaUsd: 250, facturacionUsd: 900 },
      { tipo: "Reparaciones", operaciones: 1, margenPct: 60, gananciaUsd: 60, facturacionUsd: 100 },
      { tipo: "Accesorios", operaciones: 0, margenPct: 0, gananciaUsd: 0, facturacionUsd: 0 },
      { tipo: "Otros", operaciones: 0, margenPct: 0, gananciaUsd: 0, facturacionUsd: 0 },
    ]);
  });

  it("un ítem sin costoUsd cuenta como operación pero no entra en el margen", () => {
    const ventas = [
      venta("2026-09-01", 100, [
        { detalle: "Funda", cantidad: 1, precioUsd: 100, categoria: "otro" },
      ]),
    ];
    const out = margenPorTipo(ventas);
    expect(out.find((r) => r.tipo === "Accesorios")).toEqual({
      tipo: "Accesorios",
      operaciones: 1,
      margenPct: 0,
      gananciaUsd: 0,
      facturacionUsd: 0,
    });
  });
});

describe("ventasPorRubroMes", () => {
  it("agrupa por mes y rubro, completando meses/rubros sin ventas con 0", () => {
    const hoy = new Date(2026, 8, 14); // 14 sep 2026
    const ventas = [
      venta("2026-09-05", 550, [
        { detalle: "iPhone 13", cantidad: 1, precioUsd: 450, categoria: "equipo" },
        { detalle: "Cambio pantalla", cantidad: 1, precioUsd: 100, categoria: "servicio" },
      ]),
      venta("2026-08-01", 20, [
        { detalle: "Funda", cantidad: 1, precioUsd: 20, categoria: "otro" },
      ]),
    ];
    const out = ventasPorRubroMes(ventas, 3, hoy);
    expect(out).toEqual([
      { mes: "jul", equipo: 0, servicio: 0, otro: 0, libre: 0 },
      { mes: "ago", equipo: 0, servicio: 0, otro: 20, libre: 0 },
      { mes: "sep", equipo: 450, servicio: 100, otro: 0, libre: 0 },
    ]);
  });
});

describe("ventasPorDiaSemana", () => {
  // Septiembre 2026: el lunes 14 y el sábado 19 caen dentro del rango.
  const HOY = new Date("2026-09-30T15:00:00Z");

  it("suma facturación y operaciones por día, Lun a Dom", () => {
    const ventas = [
      venta("2026-09-14", 100), // lunes
      venta("2026-09-14", 50), // lunes
      venta("2026-09-19", 30), // sábado
    ];
    const out = ventasPorDiaSemana(ventas, { desde: "2026-09-14", hasta: "2026-09-20" }, HOY);
    expect(out[0]).toMatchObject({ dia: "Lun", usd: 150, operaciones: 2 });
    expect(out[5]).toMatchObject({ dia: "Sáb", usd: 30, operaciones: 1 });
    expect(out[6]).toMatchObject({ dia: "Dom", usd: 0, operaciones: 0 });
  });

  it("el promedio divide por las veces que cae ese día en el rango (no por los días con ventas)", () => {
    // Rango 1–30 sep 2026: 5 martes (1,8,15,22,29) y 4 sábados (5,12,19,26).
    const ventas = [venta("2026-09-01", 500), venta("2026-09-05", 400)];
    const out = ventasPorDiaSemana(ventas, { desde: "2026-09-01", hasta: "2026-09-30" }, HOY);
    expect(out[1].promedioUsd).toBe(100); // martes: 500 / 5
    expect(out[5].promedioUsd).toBe(100); // sábado: 400 / 4
    expect(out[2].promedioUsd).toBe(0); // miércoles sin ventas
  });

  it("un día que cae más veces no gana solo por calendario", () => {
    // Mismo total en un martes (5 en el mes) y en un sábado (4 en el mes).
    const ventas = [venta("2026-09-01", 500), venta("2026-09-05", 500)];
    const out = ventasPorDiaSemana(ventas, { desde: "2026-09-01", hasta: "2026-09-30" }, HOY);
    expect(out[1].usd).toBe(out[5].usd);
    expect(out[5].promedioUsd).toBeGreaterThan(out[1].promedioUsd);
  });

  it("sin rango arranca en la primera venta y termina hoy; un hasta futuro se recorta a hoy", () => {
    const ventas = [venta("2026-09-28", 70)]; // lunes
    const abierto = ventasPorDiaSemana(ventas, { desde: "", hasta: "" }, HOY);
    // 28, 29 y 30 sep = lun, mar, mié: un solo lunes en el rango.
    expect(abierto[0].promedioUsd).toBe(70);
    const futuro = ventasPorDiaSemana(ventas, { desde: "2026-09-28", hasta: "2026-12-31" }, HOY);
    expect(futuro[0].promedioUsd).toBe(70);
  });
});

function ticket(
  fechaISO: string,
  estado: Ticket["estado"],
  falla: string,
  presupuestoUsd: number,
): Ticket {
  return {
    id: 1,
    clienteId: "",
    cliente: "",
    equipo: "iPhone 13",
    imei: "",
    falla,
    tecnicoId: null,
    tecnico: null,
    estado,
    ingreso: "",
    fechaISO,
    presupuestoUsd,
    servicios: [],
  };
}

describe("ventasBrutasPorFalla", () => {
  it("suma presupuestoUsd por falla y ordena de mayor a menor", () => {
    const tickets = [
      ticket("2026-09-01", "entregado", "Pantalla rota", 100),
      ticket("2026-09-02", "en_reparacion", "Pantalla rota", 150),
      ticket("2026-09-03", "recibido", "Batería", 400),
    ];
    const out = ventasBrutasPorFalla(tickets);
    expect(out).toEqual([
      { falla: "Batería", totalUsd: 400, tickets: 1 },
      { falla: "Pantalla rota", totalUsd: 250, tickets: 2 },
    ]);
  });

  it("una falla vacía cae en \"Sin especificar\"", () => {
    const out = ventasBrutasPorFalla([ticket("2026-09-01", "recibido", "", 50)]);
    expect(out).toEqual([{ falla: "Sin especificar", totalUsd: 50, tickets: 1 }]);
  });
});

describe("antiguedadTicketsAbiertos", () => {
  it("bucketiza por días desde el ingreso, tickets entregados no cuentan", () => {
    const hoy = new Date(2026, 8, 20); // 20 sep 2026
    const tickets = [
      ticket("2026-09-19", "recibido", "A", 0), // 1 día
      ticket("2026-09-10", "en_reparacion", "B", 0), // 10 días
      ticket("2026-08-01", "listo", "C", 0), // ~50 días
      ticket("2026-08-01", "entregado", "D", 0), // entregado, no cuenta
    ];
    const out = antiguedadTicketsAbiertos(tickets, hoy);
    expect(out).toEqual([
      { rango: "0-3 días", tickets: 1 },
      { rango: "4-7 días", tickets: 0 },
      { rango: "8-15 días", tickets: 1 },
      { rango: "16-30 días", tickets: 0 },
      { rango: "+30 días", tickets: 1 },
    ]);
  });
});

describe("ticketsPorDiaSemana", () => {
  it("cuenta tickets por día de la semana, Lun a Dom", () => {
    const tickets = [
      ticket("2026-09-14", "recibido", "A", 0), // lunes
      ticket("2026-09-14", "recibido", "B", 0), // lunes
      ticket("2026-09-19", "recibido", "C", 0), // sábado
    ];
    const out = ticketsPorDiaSemana(tickets);
    expect(out[0]).toEqual({ dia: "Lun", tickets: 2 });
    expect(out[5]).toEqual({ dia: "Sáb", tickets: 1 });
    expect(out[6]).toEqual({ dia: "Dom", tickets: 0 });
  });
});

describe("funnelTickets", () => {
  it("cuenta exactos y acumulados por etapa; esperando_repuesto entra en en_reparacion", () => {
    const tickets = [
      ticket("2026-09-01", "recibido", "A", 0),
      ticket("2026-09-02", "diagnosticado", "B", 0),
      ticket("2026-09-03", "presupuestado", "C", 0),
      ticket("2026-09-04", "aprobado", "D", 0),
      ticket("2026-09-05", "en_reparacion", "E", 0),
      ticket("2026-09-06", "esperando_repuesto", "F", 0),
      ticket("2026-09-07", "listo", "G", 0),
      ticket("2026-09-08", "entregado", "H", 0),
    ];
    expect(funnelTickets(tickets)).toEqual([
      { estado: "recibido", ahora: 1, alcanzados: 8 },
      { estado: "diagnosticado", ahora: 1, alcanzados: 7 },
      { estado: "presupuestado", ahora: 1, alcanzados: 6 },
      { estado: "aprobado", ahora: 1, alcanzados: 5 },
      { estado: "en_reparacion", ahora: 2, alcanzados: 4 },
      { estado: "listo", ahora: 1, alcanzados: 2 },
      { estado: "entregado", ahora: 1, alcanzados: 1 },
    ]);
  });

  it("sin tickets da todo en 0", () => {
    expect(funnelTickets([]).every((e) => e.ahora === 0 && e.alcanzados === 0)).toBe(true);
  });
});

describe("tasaAceptacion", () => {
  it("aceptadas sobre cotizadas; los aún sin presupuesto no entran al denominador", () => {
    const tickets = [
      ticket("2026-09-01", "presupuestado", "A", 0), // cotizado, sin decisión todavía
      ticket("2026-09-02", "recibido", "B", 0), // ni siquiera cotizado
      ticket("2026-09-03", "aprobado", "C", 0),
      ticket("2026-09-04", "entregado", "D", 0),
    ];
    expect(tasaAceptacion(tickets)).toEqual({
      presupuestadas: 3,
      aceptadas: 2,
      pct: (2 / 3) * 100,
    });
  });

  it("sin presupuestos da 0, no NaN", () => {
    expect(tasaAceptacion([ticket("2026-09-01", "recibido", "A", 0)])).toEqual({
      presupuestadas: 0,
      aceptadas: 0,
      pct: 0,
    });
  });
});

describe("rentabilidadPorMes", () => {
  it("agrupa facturación y ganancia por mes, completa vacíos y calcula margen", () => {
    const hoy = new Date(2026, 8, 14); // 14 sep 2026
    const ventas = [
      venta("2026-09-05", 100, [
        { detalle: "iPhone 13", cantidad: 1, precioUsd: 100, costoUsd: 60, categoria: "equipo" },
      ]),
      venta("2026-09-20", 30, []), // sin ítems con costo: facturación sí, ganancia no
      venta("2026-08-01", 50, [
        { detalle: "Pantalla", cantidad: 1, precioUsd: 50, costoUsd: 25, categoria: "servicio" },
      ]),
    ];
    expect(rentabilidadPorMes(ventas, 2, hoy)).toEqual([
      { mes: "ago", facturacion: 50, ganancia: 25, margenPct: 50 },
      { mes: "sep", facturacion: 130, ganancia: 40, margenPct: 30.8 },
    ]);
  });

  it("sin ventas da todo en 0, margen 0 (no NaN)", () => {
    expect(rentabilidadPorMes([], 2, new Date(2026, 8, 14))).toEqual([
      { mes: "ago", facturacion: 0, ganancia: 0, margenPct: 0 },
      { mes: "sep", facturacion: 0, ganancia: 0, margenPct: 0 },
    ]);
  });
});

// ── Inventario ──────────────────────────────────────────────

const hoyStock = new Date(2026, 8, 14); // 14 sep 2026

function equipo(parcial: Partial<Equipo> & Pick<Equipo, "id" | "costoUsd" | "precioUsd">): Equipo {
  return {
    modelo: "iPhone 13",
    almacenamiento: "128GB",
    color: "midnight",
    imei: "0",
    bateria: 90,
    condicion: "usado",
    estado: "disponible",
    ...parcial,
  };
}

function repuesto(parcial: Partial<Repuesto> & Pick<Repuesto, "id" | "stock" | "costoUsd">): Repuesto {
  return {
    sku: "R-1",
    nombre: "Pantalla",
    modelo: "13",
    stockMin: 0,
    proveedor: "",
    ...parcial,
  };
}

function otro(parcial: Partial<OtroItem> & Pick<OtroItem, "id" | "precioUsd">): OtroItem {
  return {
    nombre: "AirPods",
    descripcion: "",
    categoria: "airpods" as OtroItem["categoria"],
    serializado: false,
    cantidad: 1,
    costoUsd: 50,
    ...parcial,
  } as OtroItem;
}

function mov(
  itemTipo: "equipo" | "repuesto" | "otro",
  itemId: string,
  tipo: MovimientoStockBulk["tipo"],
  fechaISO: string,
  detalle = "",
): MovimientoStockBulk {
  return { itemTipo, itemId, tipo, fechaISO, detalle };
}

describe("stockItems", () => {
  it("arma el stock vivo: equipos no vendidos, repuestos/otros con stock, con antigüedad por ingreso", () => {
    const equipos = [
      equipo({ id: "e1", costoUsd: 100, precioUsd: 200 }), // ingresó hace 40 días
      equipo({ id: "e2", costoUsd: 300, precioUsd: 0, estado: "vendido" }), // vendido: afuera
    ];
    const repuestos = [repuesto({ id: "r1", stock: 5, costoUsd: 10 })]; // último ingreso hace 10 días
    const otros = [otro({ id: "o1", precioUsd: 100 })]; // sin movimientos: dias null
    const movs = [
      mov("equipo", "e1", "ingreso", "2026-08-05", "Ingreso a inventario"),
      mov("equipo", "e2", "ingreso", "2026-07-01", "Ingreso a inventario"),
      mov("repuesto", "r1", "ingreso", "2026-06-01", "Ingreso: +2 unidades"),
      mov("repuesto", "r1", "ingreso", "2026-09-04", "Ingreso: +3 unidades"),
    ];
    const out = stockItems(equipos, repuestos, otros, movs, hoyStock);
    // e1: 40 días desde el PRIMER ingreso (unidad única)
    // r1: 10 días desde el ÚLTIMO ingreso (el stock mezcla tandas)
    // o1: sin registro, margen calculable pero dias null
    expect(out).toEqual([
      { categoria: "equipo", id: "e1", nombre: "iPhone 13 128GB", unidades: 1, valorUsd: 100, margenPct: 50, dias: 40 },
      { categoria: "repuesto", id: "r1", nombre: "Pantalla · 13", unidades: 5, valorUsd: 50, margenPct: null, dias: 10 },
      { categoria: "otro", id: "o1", nombre: "AirPods", unidades: 1, valorUsd: 50, margenPct: 50, dias: null },
    ]);
  });

  it("repuestos sin stock quedan afuera", () => {
    const out = stockItems([], [repuesto({ id: "r0", stock: 0, costoUsd: 10 })], [], [], hoyStock);
    expect(out).toEqual([]);
  });
});

describe("agingBuckets", () => {
  it("cuenta unidades, valor y productos por rango, y excluye los sin registro", () => {
    const items = stockItems(
      [equipo({ id: "e1", costoUsd: 100, precioUsd: 150 })],
      [repuesto({ id: "r1", stock: 4, costoUsd: 10 })],
      [otro({ id: "o1", precioUsd: 100 })], // dias null: afuera
      [
        mov("equipo", "e1", "ingreso", "2026-09-01", "Ingreso a inventario"), // 13 días
        mov("repuesto", "r1", "ingreso", "2026-03-01", "Ingreso: +4 unidades"), // ~197 días
      ],
      hoyStock,
    );
    const out = agingBuckets(items);
    expect(out.map((b) => b.rango)).toEqual(["0-30", "31-60", "61-90", "91-180", "180+"]);
    expect(out[0].total).toEqual({ unidades: 1, valor: 100, productos: 1 });
    expect(out[4].total).toEqual({ unidades: 4, valor: 40, productos: 1 });
    // el resto vacío, no ausente
    expect(out[1].total).toEqual({ unidades: 0, valor: 0, productos: 0 });
    expect(out[4].porCategoria.repuesto).toEqual({ unidades: 4, valor: 40, productos: 1 });
  });
});

describe("diasInventarioEquipos", () => {
  it("promedia el recorrido ingreso → venta de los equipos", () => {
    // el egreso real de un equipo es su venta, no un movimiento "egreso"
    const movs = [
      mov("equipo", "e1", "ingreso", "2026-07-15"),
      mov("equipo", "e2", "ingreso", "2026-08-01"),
      mov("equipo", "e2", "egreso", "2026-08-10"), // egreso de equipo: no cuenta para la rotación
    ];
    const ventas = [
      venta("2026-08-14", 150, [
        { detalle: "iPhone 13", cantidad: 1, precioUsd: 150, costoUsd: 100, equipoId: "e1", categoria: "equipo" },
      ]),
      venta("2026-08-31", 200, [
        { detalle: "iPhone 14", cantidad: 1, precioUsd: 200, costoUsd: 150, equipoId: "e2", categoria: "equipo" },
      ]),
    ];
    // e1: 15 jul → 14 ago = 30 días; e2: 1 ago → 31 ago = 30 días
    expect(diasInventarioEquipos(movs, ventas)).toBe(30);
  });

  it("null sin ningún recorrido completo (o sin movimientos)", () => {
    expect(diasInventarioEquipos([], [])).toBeNull();
    expect(diasInventarioEquipos([mov("equipo", "e1", "ingreso", "2026-08-01")], [])).toBeNull();
  });
});

describe("unidadesDeMovimiento", () => {
  it("lee el '+N unidades' / '-N unidades' del detalle de repuestos y otros", () => {
    expect(unidadesDeMovimiento("Ingreso: +3 unidades")).toBe(3);
    expect(unidadesDeMovimiento("Usado en venta V-12: -2 unidades")).toBe(2);
    expect(unidadesDeMovimiento("Devuelto al borrar venta V-3: +5 unidades")).toBe(5);
  });

  it("null si el detalle no trae cantidad (ej. equipos, unidad única)", () => {
    expect(unidadesDeMovimiento("Ingreso a inventario")).toBeNull();
    expect(unidadesDeMovimiento("Baja de inventario")).toBeNull();
  });
});


const CAJA_ARS: Caja = {
  id: "ars-1",
  nombre: "Mostrador",
  moneda: "ars",
  activa: true,
  descripcion: "",
  creadaEl: "",
  medioPago: "pesos",
};
const CAJA_USD: Caja = { ...CAJA_ARS, id: "usd-1", nombre: "Caja USD", moneda: "usd", medioPago: "dolares" };

function movCaja(over: Partial<MovimientoCaja>): MovimientoCaja {
  return {
    id: "m1",
    fecha: "",
    fechaISO: "2026-10-03",
    hora: "",
    concepto: "",
    medioPago: "pesos",
    tipo: "ingreso",
    categoria: null,
    cajaId: CAJA_ARS.id,
    monto: 0,
    cotizacion: null,
    ticketId: null,
    usuario: "",
    conciliacionId: null,
    ...over,
  };
}

function movCC(over: Partial<MovimientoCC>): MovimientoCC {
  return {
    id: "c1",
    clienteId: "cl",
    fecha: "",
    fechaISO: "2026-10-03",
    hora: "",
    concepto: "",
    tipo: "cargo",
    montoUsd: 0,
    ticketId: null,
    usuario: "",
    ...over,
  };
}

describe("movimientoEnUsd", () => {
  it("caja en USD: el monto tal cual", () => {
    expect(movimientoEnUsd(movCaja({ cajaId: CAJA_USD.id, monto: 250 }), CAJA_USD)).toBe(250);
  });

  it("caja en pesos: usa la cotización GUARDADA en el movimiento", () => {
    expect(movimientoEnUsd(movCaja({ monto: 1_400_000, cotizacion: 1400 }), CAJA_ARS)).toBe(1000);
    // la misma plata en pesos con otra cotización guardada = otros dólares
    expect(movimientoEnUsd(movCaja({ monto: 1_400_000, cotizacion: 1000 }), CAJA_ARS)).toBe(1400);
  });

  it("caja en pesos sin cotización: null (no se adivina con el blue de hoy)", () => {
    expect(movimientoEnUsd(movCaja({ monto: 1_400_000, cotizacion: null }), CAJA_ARS)).toBeNull();
    expect(movimientoEnUsd(movCaja({ monto: 1_400_000, cotizacion: 0 }), CAJA_ARS)).toBeNull();
  });
});

describe("sinCotizacion", () => {
  it("cuenta y suma en pesos solo lo que no se puede pasar a USD", () => {
    const movs = [
      movCaja({ id: "a", monto: 100_000, cotizacion: null }), // ingreso sin cotización
      movCaja({ id: "b", monto: 40_000, cotizacion: null, tipo: "egreso" }),
      movCaja({ id: "c", monto: 1_400_000, cotizacion: 1400 }), // con cotización: no cuenta
      movCaja({ id: "d", cajaId: CAJA_USD.id, monto: 500 }), // caja USD: no cuenta
    ];
    expect(sinCotizacion(movs, [CAJA_ARS, CAJA_USD])).toEqual({
      cantidad: 2,
      ingresosArs: 100_000,
      egresosArs: 40_000,
    });
  });

  it("sin movimientos viejos no hay nada que informar", () => {
    expect(sinCotizacion([movCaja({ monto: 1, cotizacion: 1400 })], [CAJA_ARS]).cantidad).toBe(0);
  });
});

describe("cobradoReparaciones", () => {
  const rango = { desde: "2026-10-01", hasta: "2026-10-31" };
  const cajas = [CAJA_ARS, CAJA_USD];

  it("suma lo cobrado en cajas (pago dividido ARS + USD) y los cargos a cuenta corriente", () => {
    const out = cobradoReparaciones(
      [
        movCaja({ id: "1", ticketId: 7, monto: 700_000, cotizacion: 1400 }), // U$ 500
        movCaja({ id: "2", ticketId: 7, cajaId: CAJA_USD.id, monto: 100 }), // U$ 100
        movCaja({ id: "3", ticketId: 8, cajaId: CAJA_USD.id, monto: 60 }),
      ],
      [movCC({ ticketId: 9, montoUsd: 80 })],
      cajas,
      rango,
    );
    expect(out.cajaUsd).toBe(660);
    expect(out.ccUsd).toBe(80);
    expect(out.totalUsd).toBe(740);
    expect([...out.ticketIds].sort()).toEqual([7, 8, 9]);
  });

  it("un ticket sin entregar (sin cobro) no aporta nada", () => {
    const out = cobradoReparaciones([], [], cajas, rango);
    expect(out.totalUsd).toBe(0);
    expect(out.ticketIds.size).toBe(0);
  });

  it("ignora movimientos sin ticket, egresos, pagos de CC y cobros fuera del rango", () => {
    const out = cobradoReparaciones(
      [
        movCaja({ id: "1", ticketId: null, cajaId: CAJA_USD.id, monto: 999 }), // manual/venta
        movCaja({ id: "2", ticketId: 5, tipo: "egreso", cajaId: CAJA_USD.id, monto: 999 }),
        movCaja({ id: "3", ticketId: 6, cajaId: CAJA_USD.id, monto: 999, fechaISO: "2026-09-30" }),
      ],
      [movCC({ ticketId: 5, tipo: "pago", montoUsd: 999 }), movCC({ ticketId: 6, montoUsd: 999, fechaISO: "2026-11-01" })],
      cajas,
      rango,
    );
    expect(out.totalUsd).toBe(0);
  });

  it("un cobro en pesos sin cotización no se suma: se informa aparte", () => {
    const out = cobradoReparaciones(
      [movCaja({ ticketId: 7, monto: 300_000, cotizacion: null })],
      [],
      cajas,
      rango,
    );
    expect(out.totalUsd).toBe(0);
    expect(out.ticketIds.size).toBe(0);
    expect(out.sinCotizacion).toEqual({ cantidad: 1, ars: 300_000 });
  });
});

describe("margen: un solo criterio en toda la app", () => {
  it("margenPonderado coincide con el margen que sale de sumar margenPorTipo", () => {
    const ventas = [
      venta("2026-09-01", 1000, [
        { detalle: "iPhone", cantidad: 1, precioUsd: 800, costoUsd: 600, categoria: "equipo" },
        { detalle: "Funda sin costo", cantidad: 1, precioUsd: 200, categoria: "otro" },
      ]),
      venta("2026-09-02", 100, [
        { detalle: "Cambio pantalla", cantidad: 1, precioUsd: 100, costoUsd: 40, categoria: "servicio" },
      ]),
    ];
    const tipos = margenPorTipo(ventas);
    const ganancia = tipos.reduce((a, t) => a + t.gananciaUsd, 0);
    const base = tipos.reduce((a, t) => a + t.facturacionUsd, 0);
    // El ítem sin costo no entra en ninguno de los dos.
    expect(margenPonderado(ventas)).toBeCloseTo((ganancia / base) * 100, 6);
    expect(margenPonderado(ventas)).toBeCloseTo(((200 + 60) / 900) * 100, 6);
  });

  it("sin ningún costo cargado no hay margen (null), no 100 %", () => {
    const ventas = [venta("2026-09-01", 50, [{ detalle: "x", cantidad: 1, precioUsd: 50, categoria: "otro" }])];
    expect(margenPonderado(ventas)).toBeNull();
  });
});
