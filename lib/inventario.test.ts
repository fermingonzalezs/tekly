import { describe, expect, it } from "vitest";
import {
  agingEquipos,
  equiposPorEstado,
  resumenEquipos,
  resumenOtros,
  resumenRepuestos,
  stockVsMinimo,
  unidadesPorCategoria,
  valorPorCategoria,
  valorPorProveedor,
} from "@/lib/inventario";
import type { Equipo, EquipoStatus, OtroItem, Repuesto } from "@/lib/types";

function equipo(id: string, estado: EquipoStatus, costoUsd = 100, precioUsd = 150): Equipo {
  return {
    id,
    modelo: `iPhone ${id}`,
    almacenamiento: "128GB",
    color: "Negro",
    imei: id,
    bateria: 100,
    condicion: "A",
    costoUsd,
    precioUsd,
    estado,
  };
}

function repuesto(
  id: string,
  { stock, stockMin = 2, costoUsd = 10, proveedor = "Proveedor A" }: Partial<Repuesto> = {},
): Repuesto {
  return {
    id,
    sku: `SKU-${id}`,
    nombre: `Repuesto ${id}`,
    modelo: "iPhone 13",
    stock: stock ?? 5,
    stockMin,
    costoUsd,
    proveedor,
  };
}

function otro(
  id: string,
  categoria: OtroItem["categoria"],
  cantidad: number,
  costoUsd = 10,
): OtroItem {
  return {
    id,
    nombre: `Otro ${id}`,
    categoria,
    precioUsd: 20,
    serializado: false,
    cantidad,
    costoUsd,
  };
}

describe("equiposPorEstado", () => {
  it("cuenta por estado y descarta los estados sin unidades", () => {
    const equipos = [
      equipo("1", "disponible"),
      equipo("2", "disponible"),
      equipo("3", "vendido"),
      equipo("4", "reservado"),
    ];
    expect(equiposPorEstado(equipos)).toEqual([
      { label: "Disponible", value: 2 },
      { label: "Reservado", value: 1 },
      { label: "Vendido", value: 1 },
    ]);
  });

  it("sin equipos devuelve una lista vacía", () => {
    expect(equiposPorEstado([])).toEqual([]);
  });
});

describe("agingEquipos", () => {
  const hoy = "2026-10-04";

  it("ubica cada equipo en su rango desde el primer ingreso", () => {
    const equipos = [equipo("1", "disponible"), equipo("2", "disponible"), equipo("3", "disponible")];
    const movimientos = [
      { itemTipo: "equipo" as const, itemId: "1", tipo: "ingreso", fechaISO: "2026-09-20" }, // 14 d
      { itemTipo: "equipo" as const, itemId: "2", tipo: "ingreso", fechaISO: "2026-08-01" }, // 64 d
      { itemTipo: "equipo" as const, itemId: "3", tipo: "ingreso", fechaISO: "2025-01-01" }, // 180+
    ];
    expect(agingEquipos(equipos, movimientos, hoy)).toEqual([
      { label: "0-30", value: 1 },
      { label: "61-90", value: 1 },
      { label: "180+", value: 1 },
    ]);
  });

  it("usa el primer ingreso cuando hay varios", () => {
    const equipos = [equipo("1", "disponible")];
    const movimientos = [
      { itemTipo: "equipo" as const, itemId: "1", tipo: "ingreso", fechaISO: "2025-01-01" },
      { itemTipo: "equipo" as const, itemId: "1", tipo: "ingreso", fechaISO: "2026-10-01" },
    ];
    expect(agingEquipos(equipos, movimientos, hoy)).toEqual([{ label: "180+", value: 1 }]);
  });

  it("excluye vendidos y los que no tienen ingreso registrado", () => {
    const equipos = [equipo("1", "vendido"), equipo("2", "disponible")];
    const movimientos = [
      { itemTipo: "equipo" as const, itemId: "1", tipo: "ingreso", fechaISO: "2026-09-20" },
    ];
    expect(agingEquipos(equipos, movimientos, hoy)).toEqual([]);
  });
});

describe("stockVsMinimo", () => {
  it("ordena por urgencia (stock/mínimo) y acota el resultado", () => {
    const repuestos = [
      repuesto("a", { stock: 10, stockMin: 2 }), // ratio 5
      repuesto("b", { stock: 1, stockMin: 4 }), // ratio 0.25
      repuesto("c", { stock: 0, stockMin: 2 }), // ratio 0
    ];
    expect(stockVsMinimo(repuestos, 2)).toEqual([
      { label: "Repuesto c · mín 2", value: 0 },
      { label: "Repuesto b · mín 4", value: 1 },
    ]);
  });

  it("descarta los que no tienen mínimo definido", () => {
    expect(stockVsMinimo([repuesto("a", { stock: 5, stockMin: 0 })])).toEqual([]);
  });
});

describe("valorPorProveedor", () => {
  it("suma el valor a costo por proveedor y ordena descendente", () => {
    const repuestos = [
      repuesto("a", { stock: 2, costoUsd: 10, proveedor: "A" }), // 20
      repuesto("b", { stock: 3, costoUsd: 10, proveedor: "A" }), // 30
      repuesto("c", { stock: 1, costoUsd: 100, proveedor: "B" }), // 100
      repuesto("d", { stock: 5, costoUsd: 10, proveedor: "—" }), // 50 sin proveedor
    ];
    expect(valorPorProveedor(repuestos)).toEqual([
      { label: "B", value: 100 },
      { label: "A", value: 50 },
      { label: "Sin proveedor", value: 50 },
    ]);
  });
});

describe("unidadesPorCategoria / valorPorCategoria", () => {
  const otros = [
    otro("1", "ipad", 2, 100),
    otro("2", "ipad", 1, 100),
    otro("3", "airpods", 4, 25),
  ];

  it("agrupa unidades por categoría en orden fijo", () => {
    expect(unidadesPorCategoria(otros)).toEqual([
      { label: "iPad", value: 3 },
      { label: "AirPods", value: 4 },
    ]);
  });

  it("agrupa valor por categoría y ordena descendente", () => {
    expect(valorPorCategoria(otros)).toEqual([
      { label: "iPad", value: 300 },
      { label: "AirPods", value: 100 },
    ]);
  });
});

describe("resumenEquipos", () => {
  it("calcula totales, disponibles y capital inmovilizado", () => {
    const equipos = [
      equipo("1", "disponible", 100, 150),
      equipo("2", "vendido", 200, 300),
      equipo("3", "reservado", 50, 80),
    ];
    expect(resumenEquipos(equipos)).toEqual({
      total: 3,
      disponibles: 1,
      reservados: 1,
      valorCosto: 350,
      valorVenta: 530,
      capitalInmovilizado: 150,
    });
  });
});

describe("resumenRepuestos", () => {
  it("cuenta bajo mínimo (stock > 0) y sin stock por separado", () => {
    const repuestos = [
      repuesto("a", { stock: 3, stockMin: 2 }),
      repuesto("b", { stock: 2, stockMin: 2 }),
      repuesto("c", { stock: 0, stockMin: 2 }),
    ];
    expect(resumenRepuestos(repuestos)).toEqual({
      total: 3,
      unidades: 5,
      valor: 50,
      bajoMinimo: 1,
      sinStock: 1,
    });
  });
});

describe("resumenOtros", () => {
  it("suma unidades/valor y cuenta serializados", () => {
    const otros: OtroItem[] = [
      otro("1", "ipad", 2, 100),
      {
        id: "2",
        nombre: "AirPods",
        categoria: "airpods",
        precioUsd: 50,
        serializado: true,
        unidades: [
          { serial: "S1", costoUsd: 30 },
          { serial: "S2", costoUsd: 40 },
        ],
      },
    ];
    expect(resumenOtros(otros)).toEqual({
      total: 2,
      unidades: 4,
      valor: 270,
      valorVenta: 140,
      serializados: 1,
    });
  });
});
