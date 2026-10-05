import { describe, expect, it } from "vitest";
import { paginasVisibles } from "@/lib/pagination";

describe("paginasVisibles", () => {
  it("una sola página", () => {
    expect(paginasVisibles(1, 1)).toEqual([1]);
  });

  it("total 0 no devuelve nada", () => {
    expect(paginasVisibles(1, 0)).toEqual([]);
  });

  it("hasta 7 páginas las muestra todas", () => {
    expect(paginasVisibles(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("con muchas páginas recorta y pone elipsis a los dos lados", () => {
    expect(paginasVisibles(5, 20)).toEqual([1, "…", 4, 5, 6, "…", 20]);
  });

  it("al principio no pone elipsis a la izquierda", () => {
    expect(paginasVisibles(1, 20)).toEqual([1, 2, "…", 20]);
    expect(paginasVisibles(2, 20)).toEqual([1, 2, 3, "…", 20]);
  });

  it("al final no pone elipsis a la derecha", () => {
    expect(paginasVisibles(19, 20)).toEqual([1, "…", 18, 19, 20]);
  });

  it("no repite números ni se pasa del total", () => {
    expect(paginasVisibles(8, 8)).toEqual([1, "…", 7, 8]);
  });
});
