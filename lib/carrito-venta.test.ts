import { describe, expect, it } from "vitest";
import {
  alternarEnCarrito,
  enCarrito,
  filtrarDisponibles,
  parseCarrito,
  totalCarrito,
  type ItemCarrito,
} from "./carrito-venta";

const cel: ItemCarrito = { tipo: "celular", id: "c1", nombre: "iPhone 15", precioUsd: 700 };
const nb: ItemCarrito = { tipo: "notebook", id: "n1", nombre: "MacBook Air", precioUsd: 1000 };

describe("carrito de venta", () => {
  it("alterna: agrega una vez y saca si ya estaba", () => {
    const uno = alternarEnCarrito([], cel);
    expect(uno).toEqual([cel]);
    expect(enCarrito(uno, "celular", "c1")).toBe(true);
    expect(alternarEnCarrito(uno, cel)).toEqual([]);
  });

  it("mismo id en otro tipo es otra unidad", () => {
    const c = alternarEnCarrito([cel], { ...nb, id: "c1" });
    expect(c).toHaveLength(2);
  });

  it("total", () => {
    expect(totalCarrito([cel, nb])).toBe(1700);
  });

  it("parse tolera basura", () => {
    expect(parseCarrito(null)).toEqual([]);
    expect(parseCarrito("no es json")).toEqual([]);
    expect(parseCarrito(JSON.stringify({ a: 1 }))).toEqual([]);
    expect(parseCarrito(JSON.stringify([cel, { tipo: "otro", id: "x" }]))).toEqual([cel]);
  });

  it("al pasar a la venta deja afuera lo que ya no está disponible", () => {
    const r = filtrarDisponibles([cel, nb], {
      celulares: new Set(["c1"]),
      notebooks: new Set(),
    });
    expect(r.entran).toEqual([cel]);
    expect(r.afuera).toEqual([nb]);
  });
});
