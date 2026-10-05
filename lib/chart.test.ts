import { describe, expect, it } from "vitest";
import { ticksEje, fmtUsdCompact } from "@/lib/chart";

describe("ticksEje", () => {
  it("redondea el máximo hacia arriba a un número lindo y devuelve [0, mitad, máximo]", () => {
    expect(ticksEje(1234)).toEqual([0, 750, 1500]);
    expect(ticksEje(3800)).toEqual([0, 2000, 4000]);
    expect(ticksEje(700)).toEqual([0, 400, 800]);
  });

  it("máximo exacto ya lindo no infla la escala", () => {
    expect(ticksEje(1000)).toEqual([0, 500, 1000]);
    expect(ticksEje(200)).toEqual([0, 100, 200]);
  });

  it("sin datos (0/negativo) devuelve una escala mínima razonable", () => {
    expect(ticksEje(0)).toEqual([0, 5, 10]);
    expect(ticksEje(-3)).toEqual([0, 5, 10]);
  });
});

describe("fmtUsdCompact", () => {
  it("formatea compacto: unidades, miles con k y cero pelado", () => {
    expect(fmtUsdCompact(0)).toBe("0");
    expect(fmtUsdCompact(500)).toBe("U$ 500");
    expect(fmtUsdCompact(1500)).toBe("U$ 1,5k");
    expect(fmtUsdCompact(12000)).toBe("U$ 12k");
  });
});
