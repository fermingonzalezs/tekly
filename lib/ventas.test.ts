import { describe, expect, it } from "vitest";
import {
  calcularMargenPct,
  calcularRestante,
  saldarUltimoPago,
  montoConRecargo,
  montoPagoLabel,
  margenVenta,
  margenPonderado,
  motivoNoConfirmable,
  resumenDeVentas,
  graficosDeVentas,
} from "@/lib/ventas";

describe("calcularMargenPct", () => {
  it("0 si no hay precio (evita división por 0)", () => {
    expect(calcularMargenPct(0, 0)).toBe(0);
  });
  it("calcula el % de margen sobre precio", () => {
    expect(calcularMargenPct(100, 60)).toBe(40);
  });
});

describe("calcularRestante", () => {
  it("positivo cuando falta cobrar", () => {
    expect(calcularRestante(100, [{ montoUsd: 60 }])).toBe(40);
  });
  it("negativo cuando se pasaron de monto", () => {
    expect(calcularRestante(100, [{ montoUsd: 120 }])).toBe(-20);
  });
  it("0 cuando está saldado", () => {
    expect(calcularRestante(100, [{ montoUsd: 40 }, { montoUsd: 60 }])).toBe(0);
  });
});

describe("saldarUltimoPago", () => {
  it("ajusta el último pago para cerrar el restante", () => {
    const pagos = [{ montoUsd: 40 }, { montoUsd: 30 }];
    const result = saldarUltimoPago(pagos, 30); // faltaban 30
    expect(result).toEqual([{ montoUsd: 40 }, { montoUsd: 60 }]);
  });
  it("nunca deja el monto negativo", () => {
    const pagos = [{ montoUsd: 10 }];
    const result = saldarUltimoPago(pagos, -50); // sobraban 50
    expect(result[0].montoUsd).toBe(0);
  });
  it("con lista vacía no rompe", () => {
    expect(saldarUltimoPago([], 10)).toEqual([]);
  });
});

describe("montoConRecargo", () => {
  it("sin recargo devuelve el mismo monto", () => {
    expect(montoConRecargo(100, undefined)).toBe(100);
    expect(montoConRecargo(100, 0)).toBe(100);
  });
  it("aplica el % de recargo sobre el monto", () => {
    expect(montoConRecargo(100, 10)).toBe(110);
  });
  it("redondea a centavos", () => {
    expect(montoConRecargo(33.33, 15)).toBe(38.33);
  });
});

describe("montoPagoLabel", () => {
  it("pago a una caja ARS con snapshot: usa el monto en pesos guardado", () => {
    expect(montoPagoLabel({ medio: "pesos", montoUsd: 100, caja: "ars", montoArs: 161150, cotizacion: 1465 })).toBe("$\u00a0161.150");
  });
  it("pago ARS sin snapshot (venta vieja): cae a USD, nunca recalcula", () => {
    expect(montoPagoLabel({ medio: "pesos", montoUsd: 100, caja: "ars" })).toBe("U$ 100");
  });
  it("pago USD: siempre USD", () => {
    expect(montoPagoLabel({ medio: "dolares", montoUsd: 250, caja: "usd" })).toBe("U$ 250");
  });
});

describe("margenVenta", () => {
  it("calcula costo/ganancia/margen solo sobre los ítems con costo cargado", () => {
    const out = margenVenta([
      { detalle: "A", cantidad: 1, precioUsd: 100, costoUsd: 60 },
      { detalle: "B", cantidad: 2, precioUsd: 50 }, // sin costo: no entra
    ]);
    expect(out.costoUsd).toBe(60);
    expect(out.gananciaUsd).toBe(40);
    expect(out.margenPct).toBe(40);
  });
  it("venta sin ningún costo cargado: null (sin dato), no 100%", () => {
    const out = margenVenta([{ detalle: "A", cantidad: 1, precioUsd: 100 }]);
    expect(out.margenPct).toBeNull();
  });
  it("mezcla: solo los que tienen costo entran al cálculo", () => {
    const out = margenVenta([
      { detalle: "A", cantidad: 1, precioUsd: 200, costoUsd: 100 },
      { detalle: "B", cantidad: 1, precioUsd: 100, costoUsd: 50 },
      { detalle: "C", cantidad: 1, precioUsd: 300 },
    ]);
    expect(out.costoUsd).toBe(150);
    expect(out.gananciaUsd).toBe(150);
    expect(out.margenPct).toBe(50);
  });
  it("pesa por monto (cantidad), no por fila", () => {
    const out = margenVenta([{ detalle: "A", cantidad: 3, precioUsd: 100, costoUsd: 50 }]);
    expect(out.costoUsd).toBe(150);
    expect(out.margenPct).toBe(50);
  });
});

describe("margenPonderado", () => {
  function venta(items: { precioUsd: number; costoUsd?: number }[]) {
    return {
      id: "V-1", fecha: "", fechaISO: "2026-10-01", clienteId: "", cliente: "",
      vendedorId: "", vendedor: "",
      items: items.map((i) => ({ detalle: "x", cantidad: 1, ...i })),
      totalUsd: items.reduce((a, i) => a + i.precioUsd, 0), pagos: [],
      margenPct: 0, tipo: "venta" as const, modalidad: "minorista" as const,
    };
  }
  it("pondera por facturación: la venta grande pesa más que la chica", () => {
    // 2000 con 10% + 20 con 50% -> ponderado (200 + 10) / 2020 = 10.4%, no 30%
    const out = margenPonderado([
      venta([{ precioUsd: 2000, costoUsd: 1800 }]),
      venta([{ precioUsd: 20, costoUsd: 10 }]),
    ]);
    expect(out).not.toBeNull();
    expect(out!).toBeCloseTo(10.4, 1);
  });
  it("ignora ítems sin costo (no inflan el margen)", () => {
    const out = margenPonderado([
      venta([{ precioUsd: 100, costoUsd: 50 }, { precioUsd: 900 }]),
    ]);
    expect(out).toBe(50);
  });
  it("sin ningún costo cargado: null", () => {
    expect(margenPonderado([venta([{ precioUsd: 100 }])])).toBeNull();
    expect(margenPonderado([])).toBeNull();
  });
});

describe("resumenDeVentas", () => {
  const venta = (
    totalUsd: number,
    items: { cantidad: number; precioUsd: number; costoUsd?: number }[],
  ) => ({ totalUsd, items });

  it("calcula operaciones, facturado, ticket promedio e ítems vendidos", () => {
    const r = resumenDeVentas([
      venta(1000, [{ cantidad: 1, precioUsd: 1000, costoUsd: 600 }]),
      venta(500, [{ cantidad: 2, precioUsd: 250, costoUsd: 100 }]),
    ]);
    expect(r.operaciones).toBe(2);
    expect(r.facturado).toBe(1500);
    expect(r.ticketPromedio).toBe(750);
    expect(r.itemsVendidos).toBe(3);
    // (400 + 300) / 1500 = 46.67%
    expect(r.margenPct).toBeCloseTo(46.67, 1);
  });

  it("sin ventas no divide por cero", () => {
    const r = resumenDeVentas([]);
    expect(r).toEqual({
      operaciones: 0,
      facturado: 0,
      ticketPromedio: 0,
      itemsVendidos: 0,
      margenPct: null,
    });
  });

  it("sin costos cargados el margen es null (sin dato)", () => {
    expect(resumenDeVentas([venta(100, [{ cantidad: 1, precioUsd: 100 }])]).margenPct).toBeNull();
  });
});

describe("motivoNoConfirmable", () => {
  const base = {
    clienteNombre: "Caro",
    items: [{ detalle: "iPhone 13", precioUsd: 500 }],
    pagos: [{ montoUsd: 500, medio: "pesos" as const }],
    totalPrecio: 500,
  };

  it("null cuando está todo listo", () => {
    expect(motivoNoConfirmable(base)).toBeNull();
  });

  it("sigue el orden de prioridad de los motivos", () => {
    expect(motivoNoConfirmable({ ...base, clienteNombre: "" })).toBe("Elegí un cliente");
    expect(motivoNoConfirmable({ ...base, items: [] })).toBe("Agregá al menos un ítem");
    expect(
      motivoNoConfirmable({ ...base, items: [{ detalle: "x", precioUsd: 0 }] }),
    ).toBe("Hay un ítem sin precio");
  });

  it("dice cuánto falta o sobra", () => {
    expect(motivoNoConfirmable({ ...base, pagos: [{ montoUsd: 380, medio: "pesos" }] })).toBe(
      "Faltan U$ 120 por cobrar",
    );
    expect(motivoNoConfirmable({ ...base, pagos: [{ montoUsd: 530, medio: "pesos" }] })).toBe(
      "Sobran U$ 30",
    );
  });

  it("exige cargar el equipo del canje", () => {
    expect(
      motivoNoConfirmable({
        ...base,
        pagos: [{ montoUsd: 500, medio: "canje" }],
      }),
    ).toBe("Falta cargar el equipo del canje");
  });

  it("no deja ningún pago con monto 0 aunque la suma cierre", () => {
    expect(
      motivoNoConfirmable({
        ...base,
        pagos: [
          { montoUsd: 500, medio: "pesos" },
          { montoUsd: 0, medio: "dolares" },
        ],
      }),
    ).toBe("Completá el monto de cada pago");
  });
});

describe("graficosDeVentas", () => {
  it("agrupa la facturación por día en hora argentina", () => {
    const { porDia } = graficosDeVentas([
      { fechaISO: "2026-09-07T12:00:00-03:00", totalUsd: 100, rubros: [] },
      { fechaISO: "2026-09-07T18:00:00-03:00", totalUsd: 50, rubros: [] },
      // 02:00 UTC del 8 = 23:00 ART del 7
      { fechaISO: "2026-09-08T02:00:00Z", totalUsd: 25, rubros: [] },
    ]);
    expect(porDia).toEqual([{ label: "07/09", value: 175 }]);
  });

  it("ordena los días cronológicamente y arma dd/mm", () => {
    const { porDia } = graficosDeVentas([
      { fechaISO: "2026-09-10T12:00:00-03:00", totalUsd: 10, rubros: [] },
      { fechaISO: "2026-09-08T12:00:00-03:00", totalUsd: 20, rubros: [] },
    ]);
    expect(porDia.map((d) => d.label)).toEqual(["08/09", "10/09"]);
  });

  it("suma el mix por rubro en orden fijo y omite los vacíos", () => {
    const { porRubro } = graficosDeVentas([
      {
        fechaISO: "2026-09-07T12:00:00-03:00",
        totalUsd: 100,
        rubros: [
          { rubro: "servicio", monto: 30 },
          { rubro: "equipo", monto: 70 },
        ],
      },
      {
        fechaISO: "2026-09-07T13:00:00-03:00",
        totalUsd: 40,
        rubros: [{ rubro: "equipo", monto: 40 }],
      },
    ]);
    expect(porRubro).toEqual([
      { label: "Equipos", value: 110 },
      { label: "Reparaciones", value: 30 },
    ]);
  });

  it("sin ventas devuelve listas vacías", () => {
    expect(graficosDeVentas([])).toEqual({ porDia: [], porRubro: [] });
  });
});
