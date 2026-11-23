import { describe, expect, it } from "vitest";
import {
  armarResumenMensual,
  esPeriodo,
  etiquetaPeriodo,
  periodoACerrar,
  periodoAnteriorA,
  rangoDeMes,
  type InputResumenMensual,
} from "@/lib/resumen-mensual";
import type { Venta, VentaItem } from "@/lib/types";

function venta(
  id: string,
  fechaISO: string,
  totalUsd: number,
  items: VentaItem[] = [],
  vendedor = "Ana",
): Venta {
  return {
    id,
    fecha: "",
    fechaISO,
    clienteId: "c1",
    cliente: "Caro",
    vendedorId: "u1",
    vendedor,
    items,
    totalUsd,
    pagos: [{ medio: "transferencia", montoUsd: totalUsd, caja: "usd" }],
    margenPct: 0,
    tipo: "venta",
    modalidad: "minorista",
  };
}

function vacio(over: Partial<InputResumenMensual> = {}): InputResumenMensual {
  return {
    periodo: "2026-09",
    hoy: new Date("2026-10-01T04:30:00Z"), // 01:30 del 1/10 en Argentina
    cotizacion: 1400,
    objetivoMesUsd: 0,
    ventas: [],
    tickets: [],
    movimientos: [],
    movimientosCC: [],
    cajas: [],
    compras: [],
    celulares: [],
    notebooks: [],
    repuestos: [],
    otros: [],
    movimientosStock: [],
    clientes: [],
    turnos: [],
    ...over,
  };
}

describe("períodos", () => {
  it("valida el formato YYYY-MM", () => {
    expect(esPeriodo("2026-09")).toBe(true);
    expect(esPeriodo("2026-13")).toBe(false);
    expect(esPeriodo("2026-9")).toBe(false);
    expect(esPeriodo("2026-09-01")).toBe(false);
  });

  it("rango del mes, con febrero bisiesto y años que cambian", () => {
    expect(rangoDeMes("2026-09")).toEqual({ desde: "2026-09-01", hasta: "2026-09-30" });
    expect(rangoDeMes("2028-02").hasta).toBe("2028-02-29");
    expect(rangoDeMes("2026-12").hasta).toBe("2026-12-31");
    expect(periodoAnteriorA("2026-01")).toBe("2025-12");
    expect(periodoAnteriorA("2026-10")).toBe("2026-09");
  });

  it("el mes a cerrar es el anterior en hora argentina", () => {
    // 1/10 01:30 ART = 04:30 UTC -> cierra septiembre
    expect(periodoACerrar(new Date("2026-10-01T04:30:00Z"))).toBe("2026-09");
    // 1/10 00:30 UTC todavía es 30/9 en Argentina -> cierra agosto
    expect(periodoACerrar(new Date("2026-10-01T00:30:00Z"))).toBe("2026-08");
    expect(periodoACerrar(new Date("2026-01-01T04:30:00Z"))).toBe("2025-12");
  });

  it("etiqueta legible", () => {
    expect(etiquetaPeriodo("2026-09")).toBe("septiembre de 2026");
  });
});

describe("armarResumenMensual", () => {
  it("un mes sin datos devuelve ceros y no revienta", () => {
    const r = armarResumenMensual(vacio());
    expect(r.ventas.facturacionUsd).toBe(0);
    expect(r.ventas.operaciones).toBe(0);
    expect(r.ventas.margenPct).toBeNull();
    expect(r.objetivo).toBeNull();
    expect(r.patrimonio?.netoUsd).toBe(0);
    expect(r.version).toBe(1);
    expect(r.periodo).toBe("2026-09");
  });

  it("solo cuenta las ventas del mes y compara con el anterior", () => {
    const r = armarResumenMensual(
      vacio({
        ventas: [
          venta("V-1", "2026-09-05", 100),
          venta("V-2", "2026-09-30", 300, [], "Beto"),
          venta("V-3", "2026-10-01", 999), // otro mes
          venta("V-4", "2026-08-31", 200), // mes anterior
        ],
      }),
    );
    expect(r.ventas.facturacionUsd).toBe(400);
    expect(r.ventas.operaciones).toBe(2);
    expect(r.ventas.ticketPromedioUsd).toBe(200);
    expect(r.ventas.deltas.facturacion).toBe(100); // 400 vs 200
    expect(r.ventas.porVendedor.map((v) => v.label).sort()).toEqual(["Ana", "Beto"]);
    expect(r.ventas.porMedio).toEqual([{ label: "Transferencia", value: 400 }]);
  });

  it("cumplimiento del objetivo en %", () => {
    const r = armarResumenMensual(
      vacio({ objetivoMesUsd: 1000, ventas: [venta("V-1", "2026-09-10", 250)] }),
    );
    expect(r.objetivo).toEqual({ objetivoUsd: 1000, cumplidoPct: 25 });
  });

  it("sin cotización válida no arma el patrimonio (no inventa un neto)", () => {
    expect(armarResumenMensual(vacio({ cotizacion: null })).patrimonio).toBeNull();
    expect(armarResumenMensual(vacio({ cotizacion: 0 })).patrimonio).toBeNull();
    expect(armarResumenMensual(vacio({ cotizacion: null })).cotizacion.valor).toBeNull();
  });

  it("las fotos son fieles solo si se generó pasado el cierre y dentro de 3 días", () => {
    const fiable = (hoy: string) =>
      armarResumenMensual(vacio({ hoy: new Date(hoy) })).foto.fiable;
    expect(fiable("2026-10-01T04:30:00Z")).toBe(true); // cron, día 1
    expect(fiable("2026-10-03T12:00:00Z")).toBe(true); // 3er día
    expect(fiable("2026-10-20T12:00:00Z")).toBe(false); // manual tardío
    expect(fiable("2026-09-20T12:00:00Z")).toBe(false); // mes todavía abierto
  });
});
