import { describe, expect, it } from "vitest";
import { ventasPorMes, facturacionDiaria } from "@/lib/analiticas";
import type { Venta } from "@/lib/types";

function venta(fechaISO: string, totalUsd: number): Venta {
  return {
    id: "V-1",
    fecha: "",
    fechaISO,
    clienteId: "",
    cliente: "",
    vendedorId: "",
    vendedor: "",
    items: [],
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
