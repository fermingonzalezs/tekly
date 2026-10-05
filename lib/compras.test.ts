import { describe, expect, it } from "vitest";
import {
  gastoPorMes,
  gastoPorProveedor,
  resumenCompras,
  etiquetaMes,
  mesDe,
  TOP_PROVEEDORES,
} from "@/lib/compras";
import type { Compra } from "@/lib/types";

function compra(extra: Partial<Compra>): Compra {
  return {
    id: "C-1",
    fecha: "",
    fechaISO: "2026-09-07",
    origen: "proveedor",
    items: [],
    totalUsd: 0,
    medioPago: "transferencia",
    estado: "pendiente",
    ...extra,
  };
}

describe("mesDe / etiquetaMes", () => {
  it("recorta el mes de una fecha ISO", () => {
    expect(mesDe("2026-09-07")).toBe("2026-09");
  });

  it("arma la etiqueta corta", () => {
    expect(etiquetaMes("2026-09")).toBe("sep 26");
  });
});

describe("gastoPorMes", () => {
  it("sin compras devuelve lista vacía", () => {
    expect(gastoPorMes([])).toEqual([]);
  });

  it("agrupa por mes, incluye meses intermedios en 0 y ordena cronológico", () => {
    const rows = gastoPorMes([
      compra({ fechaISO: "2026-07-10", totalUsd: 100 }),
      compra({ fechaISO: "2026-09-02", totalUsd: 50 }),
      compra({ fechaISO: "2026-09-20", totalUsd: 25 }),
    ]);
    expect(rows).toEqual([
      { label: "jul 26", value: 100 },
      { label: "ago 26", value: 0 },
      { label: "sep 26", value: 75 },
    ]);
  });

  it("cruza el cambio de año sin saltear meses", () => {
    const rows = gastoPorMes([
      compra({ fechaISO: "2025-11-30", totalUsd: 10 }),
      compra({ fechaISO: "2026-02-01", totalUsd: 20 }),
    ]);
    expect(rows.map((r) => r.label)).toEqual([
      "nov 25",
      "dic 25",
      "ene 26",
      "feb 26",
    ]);
    expect(rows.reduce((a, r) => a + r.value, 0)).toBe(30);
  });
});

describe("gastoPorProveedor", () => {
  it("suma por proveedor, ordena desc y recorta al top", () => {
    const compras = Array.from({ length: TOP_PROVEEDORES + 2 }, (_, i) =>
      compra({ proveedor: `Prov ${i}`, totalUsd: i + 1 }),
    );
    const rows = gastoPorProveedor(compras);
    expect(rows).toHaveLength(TOP_PROVEEDORES);
    expect(rows[0]).toEqual({ label: `Prov ${TOP_PROVEEDORES + 1}`, value: TOP_PROVEEDORES + 2 });
    expect(rows[0].value).toBeGreaterThan(rows[1].value);
  });

  it("usa el cliente cuando la compra es un canje", () => {
    const rows = gastoPorProveedor([
      compra({ origen: "canje", cliente: "Ana", totalUsd: 300 }),
      compra({ proveedor: "Tecno", totalUsd: 100 }),
    ]);
    expect(rows).toEqual([
      { label: "Ana", value: 300 },
      { label: "Tecno", value: 100 },
    ]);
  });

  it("agrupa la contraparte vacía como 'Sin proveedor'", () => {
    const rows = gastoPorProveedor([compra({ totalUsd: 40 })]);
    expect(rows).toEqual([{ label: "Sin proveedor", value: 40 }]);
  });
});

describe("resumenCompras", () => {
  it("cuenta cantidad, pendientes, recibidas y promedio", () => {
    const r = resumenCompras([
      compra({ totalUsd: 100, estado: "pendiente" }),
      compra({ totalUsd: 200, estado: "recibida" }),
      compra({ totalUsd: 300, estado: "recibida" }),
    ]);
    expect(r).toEqual({
      cantidad: 3,
      gastadoUsd: 600,
      pendientes: 1,
      recibidas: 2,
      ticketPromedioUsd: 200,
    });
  });

  it("sin compras el promedio no divide por cero", () => {
    expect(resumenCompras([])).toEqual({
      cantidad: 0,
      gastadoUsd: 0,
      pendientes: 0,
      recibidas: 0,
      ticketPromedioUsd: 0,
    });
  });
});
