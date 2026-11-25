import { describe, expect, it } from "vitest";
import { aplicarDescuentoVenta, descuentoDesdePct, errorDescuento, margenVenta } from "@/lib/ventas";

const totalDe = (r: ReturnType<typeof aplicarDescuentoVenta>, cants: number[]) =>
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
