import { describe, expect, it } from "vitest";
import { movimientoStockOtro, otroDisponibles } from "./otros";
import type { OtroItem } from "./types";

const funda: OtroItem = {
  id: "o1",
  nombre: "Funda",
  categoria: "accesorio",
  precioUsd: 15,
  serializado: false,
  cantidad: 2,
  costoUsd: 3,
} as OtroItem;

const airpods: OtroItem = {
  id: "o2",
  nombre: "AirPods",
  categoria: "accesorio",
  precioUsd: 200,
  serializado: true,
  unidades: [
    { serial: "A1", costoUsd: 120 },
    { serial: "A2", costoUsd: 120, estado: "vendido" },
  ],
} as OtroItem;

describe("movimientoStockOtro", () => {
  it("por cantidad: resta al vender y suma al devolver", () => {
    expect(movimientoStockOtro(funda, { cantidad: 1 }, "egreso")).toEqual({ ok: true, patch: { cantidad: 1 } });
    expect(movimientoStockOtro(funda, { cantidad: 1 }, "ingreso")).toEqual({ ok: true, patch: { cantidad: 3 } });
  });
  it("no deja stock negativo", () => {
    expect(movimientoStockOtro(funda, { cantidad: 3 }, "egreso").ok).toBe(false);
  });
  it("serializado: marca la unidad vendida / disponible", () => {
    const r = movimientoStockOtro(airpods, { cantidad: 1, serial: "A1" }, "egreso");
    expect(r.ok && "unidades" in r.patch && r.patch.unidades[0].estado).toBe("vendido");
    expect(movimientoStockOtro(airpods, { cantidad: 1, serial: "A2" }, "egreso").ok).toBe(false);
    const d = movimientoStockOtro(airpods, { cantidad: 1, serial: "A2" }, "ingreso");
    expect(d.ok && "unidades" in d.patch && d.patch.unidades[1].estado).toBe("disponible");
    expect(movimientoStockOtro(airpods, { cantidad: 1 }, "egreso").ok).toBe(false);
  });
  it("disponibles", () => {
    expect(otroDisponibles(funda)).toBe(2);
    expect(otroDisponibles(airpods)).toBe(1);
  });
});
