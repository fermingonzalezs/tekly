import { describe, expect, it } from "vitest";
import {
  calcularMargenPct,
  calcularRestante,
  saldarUltimoPago,
  montoConRecargo,
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
