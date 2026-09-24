import { describe, expect, it } from "vitest";
import {
  metricasDashboard,
  objetivoDelMes,
  ventaGananciaPorPeriodo,
  ventasPorRubro,
  ventasRecientes,
} from "@/lib/dashboard";
import type { Venta, VentaItem } from "@/lib/types";

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

describe("metricasDashboard", () => {
  it("calcula ventas/margen/ticket del mes y delta vs mes anterior", () => {
    const hoy = new Date(2026, 8, 14); // 14 sep 2026
    const ventas = [venta("2026-09-05", 100, 20), venta("2026-08-05", 50, 10)];
    const out = metricasDashboard({ ventas, ticketsAbiertos: 3, turnosHoy: 2, hoy });
    const porKey = Object.fromEntries(out.map((m) => [m.key, m]));
    expect(porKey.ventas.value).toBe("U$ 100");
    expect(porKey.ventas.delta).toBe(100); // 100 vs 50 = +100%
    expect(porKey.abiertos.value).toBe("3");
    expect(porKey.abiertos.delta).toBe(0);
    expect(porKey.turnos.value).toBe("2");
  });

  it("sin ventas del mes anterior, delta 0 (no fabrica una comparación)", () => {
    const hoy = new Date(2026, 8, 14);
    const out = metricasDashboard({ ventas: [venta("2026-09-05", 100)], ticketsAbiertos: 0, turnosHoy: 0, hoy });
    expect(out.find((m) => m.key === "ventas")!.delta).toBe(0);
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
  it("'quince' trae 15 días terminando hoy", () => {
    const hoy = new Date(2026, 8, 14);
    const ventas = [venta("2026-09-14", 200, 50)];
    const out = ventaGananciaPorPeriodo(ventas, hoy).quince;
    expect(out.venta).toHaveLength(15);
    expect(out.venta[14]).toBe(200);
    expect(out.ganancia[14]).toBe(100);
    expect(out.venta[0]).toBe(0);
  });

  it("'mes' trae del día 1 a hoy", () => {
    const hoy = new Date(2026, 8, 14);
    const out = ventaGananciaPorPeriodo([venta("2026-09-01", 100)], hoy).mes;
    expect(out.venta).toHaveLength(14);
    expect(out.venta[0]).toBe(100);
  });

  it("'mesPrevio' trae el mes calendario anterior completo", () => {
    const hoy = new Date(2026, 8, 14);
    const out = ventaGananciaPorPeriodo([venta("2026-08-31", 100)], hoy).mesPrevio;
    expect(out.venta).toHaveLength(31);
    expect(out.venta[30]).toBe(100);
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
  it("ordena por fecha descendente y mapea categoría desde tipo", () => {
    const ventas = [
      venta("2026-09-01", 50, 20, { tipo: "reparacion" }),
      venta("2026-09-10", 100, 20, { tipo: "venta" }),
    ];
    const out = ventasRecientes(ventas);
    expect(out[0].monto).toBe(100);
    expect(out[0].categoria).toBe("Equipos");
    expect(out[1].categoria).toBe("Reparaciones");
  });
});
