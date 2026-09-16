import { describe, expect, it } from "vitest";
import { ventasPorMes, facturacionDiaria, margenPorTipo } from "@/lib/analiticas";
import type { Venta, VentaItem } from "@/lib/types";

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
      { tipo: "Equipos", operaciones: 2, margenPct: 27.8, gananciaUsd: 250 },
      { tipo: "Reparaciones", operaciones: 1, margenPct: 60, gananciaUsd: 60 },
      { tipo: "Accesorios", operaciones: 0, margenPct: 0, gananciaUsd: 0 },
      { tipo: "Otros", operaciones: 0, margenPct: 0, gananciaUsd: 0 },
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
    });
  });
});
