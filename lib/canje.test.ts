import { describe, expect, it } from "vitest";
import { bateriaCanje, erroresCanje, resumenCanje } from "./canje";
import { saldarUltimoPago } from "./ventas";
import type { CanjeEquipo } from "./types";

const base: CanjeEquipo = {
  modelo: "iPhone 13 128GB",
  imei: "356000000000001",
  color: "Negro",
  condicion: "A",
  bateria: 87,
  testeo: false,
};

describe("erroresCanje", () => {
  it("equipo completo con precio es válido", () => {
    expect(erroresCanje(base, 300)).toEqual([]);
  });
  it("sin equipo cargado", () => {
    expect(erroresCanje(undefined, 300)).toHaveLength(1);
  });
  it("modelo, IMEI, color y condición son obligatorios", () => {
    const e = erroresCanje({ ...base, modelo: " ", imei: "", color: "", condicion: "" }, 300);
    expect(e).toHaveLength(4);
  });
  it("la batería es obligatoria y entre 0 y 100 salvo NUEVO", () => {
    expect(erroresCanje({ ...base, bateria: undefined }, 300)).toHaveLength(1);
    expect(erroresCanje({ ...base, bateria: 101 }, 300)).toHaveLength(1);
    expect(erroresCanje({ ...base, bateria: 85.5 }, 300)).toHaveLength(1);
    expect(erroresCanje({ ...base, condicion: "NUEVO", bateria: undefined }, 300)).toEqual([]);
  });
  it("precio de compra mayor a cero", () => {
    expect(erroresCanje(base, 0)).toHaveLength(1);
  });
});

describe("bateriaCanje / resumenCanje", () => {
  it("NUEVO es 100", () => {
    expect(bateriaCanje({ condicion: "NUEVO", bateria: undefined })).toBe(100);
    expect(bateriaCanje({ condicion: "B", bateria: 80 })).toBe(80);
  });
  it("resumen", () => {
    expect(resumenCanje(base)).toBe("iPhone 13 128GB · Negro · A · 87 %");
    expect(resumenCanje({ ...base, condicion: "NUEVO" })).toBe("iPhone 13 128GB · Negro · NUEVO");
  });
});

describe("saldar con canje", () => {
  it("no toca el precio del equipo, ajusta el último pago que no es canje", () => {
    const pagos = [
      { medio: "dolares", montoUsd: 100 },
      { medio: "canje", montoUsd: 300 },
    ];
    expect(saldarUltimoPago(pagos, 50)).toEqual([
      { medio: "dolares", montoUsd: 150 },
      { medio: "canje", montoUsd: 300 },
    ]);
  });
  it("si solo hay canje, no cambia nada", () => {
    const pagos = [{ medio: "canje", montoUsd: 300 }];
    expect(saldarUltimoPago(pagos, 50)).toBe(pagos);
  });
});
