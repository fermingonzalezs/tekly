import { describe, expect, it } from "vitest";
import {
  mesPrevio,
  primeraFoto,
  serieMensual,
  variacionVsMesAnterior,
  type SnapshotPatrimonio,
} from "@/lib/patrimonio-historial";

function snap(fecha: string, patrimonioUsd: number, activoUsd = patrimonioUsd, pasivoUsd = 0): SnapshotPatrimonio {
  return { fecha, cotizacion: 1400, activoUsd, pasivoUsd, patrimonioUsd };
}

describe("serieMensual", () => {
  it("toma la última foto de cada mes y marca el mes en curso", () => {
    const s = serieMensual(
      [snap("2026-09-03", 900), snap("2026-09-28", 1000), snap("2026-10-05", 1100), snap("2026-10-17", 1200)],
      "2026-10-17",
    );
    expect(s.map((p) => [p.clave, p.patrimonioUsd, p.enCurso])).toEqual([
      ["2026-09", 1000, false],
      ["2026-10", 1200, true],
    ]);
    expect(s[0].label).toBe("sep 2026");
  });

  it("no inventa meses sin fotos y respeta el tope", () => {
    const fotos = Array.from({ length: 14 }, (_, i) => {
      const m = i + 1; // 2025-01 … 2026-02
      const y = m > 12 ? 2026 : 2025;
      return snap(`${y}-${String(((m - 1) % 12) + 1).padStart(2, "0")}-15`, 100 + i);
    });
    expect(serieMensual(fotos, "2026-02-20", 12)).toHaveLength(12);
    expect(serieMensual([snap("2026-01-10", 1), snap("2026-03-10", 2)], "2026-03-12").map((p) => p.clave)).toEqual([
      "2026-01",
      "2026-03",
    ]);
  });

  it("sin fotos, serie vacía", () => {
    expect(serieMensual([], "2026-10-17")).toEqual([]);
  });
});

describe("variacionVsMesAnterior", () => {
  const hoy = "2026-10-17";
  const actual = { activoUsd: 1320, pasivoUsd: 120, patrimonioUsd: 1200 };

  it("compara contra el cierre del mes anterior", () => {
    const v = variacionVsMesAnterior(
      [snap("2026-09-10", 500), snap("2026-09-30", 1000, 1100, 100), snap("2026-10-02", 1111)],
      actual,
      hoy,
    )!;
    expect(v.contraMes).toBe("sep 2026");
    expect(v.patrimonio).toBe(20); // 1000 -> 1200
    expect(v.activo).toBe(20); // 1100 -> 1320
    expect(v.pasivo).toBe(20); // 100 -> 120
  });

  it("sin foto del mes anterior no hay variación (el historial recién empieza)", () => {
    expect(variacionVsMesAnterior([snap("2026-10-02", 900)], actual, hoy)).toBeNull();
  });

  it("base 0 o negativa no da un porcentaje engañoso", () => {
    const v = variacionVsMesAnterior([snap("2026-09-30", -50, 0, 50)], actual, hoy)!;
    expect(v.patrimonio).toBeNull();
    expect(v.activo).toBeNull();
    expect(v.pasivo).toBe(140);
  });

  it("cruza el año (enero compara con diciembre)", () => {
    expect(mesPrevio("2026-01")).toBe("2025-12");
    const v = variacionVsMesAnterior([snap("2025-12-31", 100)], { activoUsd: 110, pasivoUsd: 0, patrimonioUsd: 110 }, "2026-01-05")!;
    expect(v.patrimonio).toBe(10);
  });
});

describe("primeraFoto", () => {
  it("devuelve la fecha más vieja o null", () => {
    expect(primeraFoto([])).toBeNull();
    expect(primeraFoto([snap("2026-10-17", 1), snap("2026-09-01", 1)])).toBe("2026-09-01");
  });
});
