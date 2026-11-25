import { describe, expect, it } from "vitest";
import {
  ajusteDesdePct,
  aplicarAjusteVenta,
  aplicarDescuentoVenta,
  descuentoDesdePct,
  errorAjuste,
  errorDescuento,
  margenVenta,
} from "@/lib/ventas";

const totalDe = (
  r: { items: { precioUsd: number }[] },
  cants: number[],
) =>
  Math.round(r.items.reduce((a, it, k) => a + it.precioUsd * cants[k] * 100, 0)) / 100;

describe("aplicarDescuentoVenta", () => {
  it("sin descuento no cambia nada", () => {
    const r = aplicarDescuentoVenta([{ cantidad: 1, precioUsd: 500 }], 0);
    expect(r.items).toEqual([{ precioUsd: 500 }]);
    expect(r.totalUsd).toBe(500);
  });
  it("U$ 10 sobre un ítem", () => {
    const r = aplicarDescuentoVenta([{ cantidad: 1, precioUsd: 500 }], 10);
    expect(r.items).toEqual([{ precioUsd: 490, precioListaUsd: 500 }]);
    expect(r.totalUsd).toBe(490);
  });
  it("3 ítems con distintos precios: suma exacta", () => {
    const items = [
      { cantidad: 1, precioUsd: 333.33 },
      { cantidad: 1, precioUsd: 100 },
      { cantidad: 1, precioUsd: 17.5 },
    ];
    const r = aplicarDescuentoVenta(items, 10);
    expect(r.totalUsd).toBe(440.83);
    expect(totalDe(r, [1, 1, 1])).toBe(440.83);
  });
  it("cantidad > 1 cierra exacto", () => {
    const items = [
      { cantidad: 3, precioUsd: 10 },
      { cantidad: 1, precioUsd: 7 },
    ];
    const r = aplicarDescuentoVenta(items, 1);
    expect(totalDe(r, [3, 1])).toBe(36);
    expect(r.totalUsd).toBe(36);
  });
  it("si no cierra exacto, aplica lo que puede y la suma sigue cuadrando", () => {
    // 3 × U$ 10 con U$ 1 de descuento y ninguna línea de cantidad 1: no hay
    // forma de repartir el centavo que sobra.
    const r = aplicarDescuentoVenta([{ cantidad: 3, precioUsd: 10 }], 1);
    expect(r.descuentoUsd).toBe(0.99);
    expect(r.totalUsd).toBe(29.01);
    expect(totalDe(r, [3])).toBe(29.01);
  });
  it("un regalo no recibe descuento y queda en 0", () => {
    const r = aplicarDescuentoVenta(
      [
        { cantidad: 1, precioUsd: 800 },
        { cantidad: 1, precioUsd: 15, regalo: true },
      ],
      10,
    );
    expect(r.items[1]).toEqual({ precioUsd: 0 });
    expect(r.subtotalUsd).toBe(800);
    expect(r.totalUsd).toBe(790);
  });
  it("el regalo con costo baja la ganancia", () => {
    const r = aplicarDescuentoVenta(
      [
        { cantidad: 1, precioUsd: 800 },
        { cantidad: 1, precioUsd: 15, regalo: true },
      ],
      10,
    );
    const m = margenVenta([
      { cantidad: 1, precioUsd: r.items[0].precioUsd, costoUsd: 600 },
      { cantidad: 1, precioUsd: r.items[1].precioUsd, costoUsd: 5 },
    ]);
    expect(m?.gananciaUsd).toBe(185);
  });
});

describe("errorDescuento / descuentoDesdePct", () => {
  it("descuento = subtotal es error", () => {
    expect(errorDescuento(100, 100)).not.toBeNull();
    expect(errorDescuento(100, -1)).not.toBeNull();
    expect(errorDescuento(100, 10)).toBeNull();
  });
  it("% a USD", () => {
    expect(descuentoDesdePct(333.33, 10)).toBe(33.33);
    expect(descuentoDesdePct(100, 0)).toBe(0);
  });
});

describe("aplicarAjusteVenta (diferencia firmada)", () => {
  it("positivo descuenta igual que aplicarDescuentoVenta", () => {
    const r = aplicarAjusteVenta([{ cantidad: 1, precioUsd: 500 }], 10);
    expect(r.items).toEqual([{ precioUsd: 490, precioListaUsd: 500 }]);
    expect(r.ajusteUsd).toBe(10);
    expect(r.totalUsd).toBe(490);
  });

  it("negativo recarga y cierra exacto", () => {
    const r = aplicarAjusteVenta([{ cantidad: 1, precioUsd: 500 }], -10);
    expect(r.items).toEqual([{ precioUsd: 510, precioListaUsd: 500 }]);
    expect(r.subtotalUsd).toBe(500);
    expect(r.ajusteUsd).toBe(-10);
    expect(r.totalUsd).toBe(510);
  });

  it("recargo con cantidad > 1 reparte centavos y cierra", () => {
    const r = aplicarAjusteVenta([{ cantidad: 3, precioUsd: 10 }], -1);
    expect(r.ajusteUsd).toBe(-0.99);
    expect(r.totalUsd).toBe(30.99);
    expect(totalDe(r, [3])).toBe(30.99);
  });

  it("recargo sin subtotal (ítem libre en 0) lo cubre", () => {
    const r = aplicarAjusteVenta([{ cantidad: 1, precioUsd: 0 }], -100);
    expect(r.items).toEqual([{ precioUsd: 100, precioListaUsd: 0 }]);
    expect(r.totalUsd).toBe(100);
    expect(r.ajusteUsd).toBe(-100);
  });

  it("% firmado y errorAjuste", () => {
    expect(ajusteDesdePct(500, 10)).toBe(50);
    expect(ajusteDesdePct(500, -10)).toBe(-50);
    expect(errorAjuste(500, 50)).toBeNull();
    expect(errorAjuste(500, 500)).not.toBeNull();
    expect(errorAjuste(500, -10)).not.toBeNull(); // solo descuento, sin recargo
  });
});

import { errorItemsVenta, esVentaRegalo, preciosDeVenta } from "@/lib/ventas";

describe("preciosDeVenta (regalos por ítem + descuento)", () => {
  it("el regalo queda en 0 y no recibe descuento", () => {
    const r = preciosDeVenta(
      [
        { cantidad: 1, precioUsd: 850 },
        { cantidad: 1, precioUsd: 15, regalo: true },
      ],
      50,
    );
    expect(r.items[0].precioUsd).toBe(800);
    expect(r.items[1]).toMatchObject({ precioUsd: 0, regalo: true });
    expect(r.totalUsd).toBe(800);
    expect(r.ajusteUsd).toBe(50);
  });
});

describe("errorItemsVenta", () => {
  it("solo stock o servicios; regalos de Otros", () => {
    const cel = { categoria: "celular" as const, celularId: "c1" };
    const funda = { categoria: "otro" as const, otroId: "o1" };
    expect(errorItemsVenta([], 0)).not.toBeNull();
    expect(errorItemsVenta([cel, { ...funda, regalo: true }], 10)).toBeNull();
    expect(errorItemsVenta([{ ...funda, regalo: true }], 0)).toBeNull(); // venta toda de regalo
    expect(errorItemsVenta([{ categoria: "servicio" as const }], 0)).toBeNull();
    expect(errorItemsVenta([{ categoria: "libre" as const }], 0)).not.toBeNull();
    expect(errorItemsVenta([{ categoria: "otro" as const }], 0)).not.toBeNull(); // sin otroId
    expect(errorItemsVenta([{ ...cel, regalo: true }], 0)).not.toBeNull();
    expect(errorItemsVenta([cel], -5)).not.toBeNull();
    const repuestoRegalo = {
      categoria: "otro" as const,
      regalo: true,
      repuestos: [{ repuestoId: "r1", nombre: "Vidrio", cantidad: 1 }],
    };
    expect(errorItemsVenta([cel, repuestoRegalo], 0)).toBeNull();
    // un repuesto suelto que no es regalo no se vende como ítem
    expect(errorItemsVenta([{ ...repuestoRegalo, regalo: false }], 0)).not.toBeNull();
  });
  it("esVentaRegalo", () => {
    expect(esVentaRegalo([{ regalo: true }])).toBe(true);
    expect(esVentaRegalo([{ regalo: true }, {}])).toBe(false);
    expect(esVentaRegalo([])).toBe(false);
  });
});
