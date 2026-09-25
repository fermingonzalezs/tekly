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
} from "@/lib/analiticas";
import type { Venta, VentaItem, Ticket, Equipo, Repuesto, OtroItem } from "@/lib/types";
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
  it("suma facturación y operaciones por día, Lun a Dom", () => {
    const ventas = [
      venta("2026-09-14", 100), // lunes
      venta("2026-09-14", 50), // lunes
      venta("2026-09-19", 30), // sábado
    ];
    const out = ventasPorDiaSemana(ventas);
    expect(out[0]).toEqual({ dia: "Lun", usd: 150, operaciones: 2 });
    expect(out[5]).toEqual({ dia: "Sáb", usd: 30, operaciones: 1 });
    expect(out[6]).toEqual({ dia: "Dom", usd: 0, operaciones: 0 });
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
