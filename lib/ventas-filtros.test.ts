import { describe, expect, it } from "vitest";
import {
  deltaHintDe,
  hayFiltrosActivos,
  parseFiltrosVentas,
  queryDeFiltros,
  rangoDe,
} from "@/lib/ventas-filtros";

const ver = { puedeVerCosto: true };
const noVer = { puedeVerCosto: false };

describe("parseFiltrosVentas", () => {
  it("sin params usa los defaults", () => {
    expect(parseFiltrosVentas({}, ver)).toEqual({
      preset: "mes",
      desde: "",
      hasta: "",
      vendedor: "",
      tipo: "",
      q: "",
      vista: "ventas",
      page: 1,
      sort: "fecha",
      dir: "desc",
    });
  });

  it("params inválidos caen al default", () => {
    const f = parseFiltrosVentas(
      { preset: "loquesea", vista: "x", sort: "hack", dir: "up", page: "abc" },
      ver,
    );
    expect(f.preset).toBe("mes");
    expect(f.vista).toBe("ventas");
    expect(f.sort).toBe("fecha");
    expect(f.dir).toBe("desc");
    expect(f.page).toBe(1);
  });

  it("page < 1 vuelve a 1", () => {
    expect(parseFiltrosVentas({ page: "0" }, ver).page).toBe(1);
    expect(parseFiltrosVentas({ page: "-3" }, ver).page).toBe(1);
  });

  it("un vendedor no puede ordenar por margen ni por URL", () => {
    expect(parseFiltrosVentas({ sort: "margen_pct" }, noVer).sort).toBe("fecha");
    expect(parseFiltrosVentas({ sort: "margen_pct" }, ver).sort).toBe("margen_pct");
  });

  it("toma el primer valor de un param repetido y trimea q", () => {
    const f = parseFiltrosVentas(
      { tipo: ["equipo", "servicio"], q: ["  hola  "] },
      ver,
    );
    expect(f.tipo).toBe("equipo");
    expect(f.q).toBe("hola");
  });

  it("fechas inválidas de un rango personalizado se descartan", () => {
    const f = parseFiltrosVentas(
      { preset: "personalizado", desde: "2026-01-01", hasta: "ayer" },
      ver,
    );
    expect(f.desde).toBe("2026-01-01");
    expect(f.hasta).toBe("");
  });
});

describe("queryDeFiltros", () => {
  it("omite los defaults", () => {
    expect(
      queryDeFiltros({
        preset: "mes",
        desde: "",
        hasta: "",
        vendedor: "",
        tipo: "",
        q: "",
        vista: "ventas",
        page: 1,
        sort: "fecha",
        dir: "desc",
      }),
    ).toBe("");
  });

  it("serializa los filtros no default y hace round-trip", () => {
    const original = {
      preset: "personalizado" as const,
      desde: "2026-01-01",
      hasta: "2026-01-31",
      vendedor: "u-1",
      tipo: "servicio" as const,
      q: "1042",
      vista: "items" as const,
      page: 3,
      sort: "total_usd" as const,
      dir: "asc" as const,
    };
    const qs = queryDeFiltros(original);
    const params = Object.fromEntries(new URLSearchParams(qs));
    expect(parseFiltrosVentas(params, ver)).toEqual(original);
  });
});

describe("hayFiltrosActivos", () => {
  const base = parseFiltrosVentas({}, ver);
  it("default no tiene filtros", () => {
    expect(hayFiltrosActivos(base)).toBe(false);
  });
  it("detecta búsqueda, vendedor, tipo y período", () => {
    expect(hayFiltrosActivos({ ...base, q: "x" })).toBe(true);
    expect(hayFiltrosActivos({ ...base, vendedor: "u1" })).toBe(true);
    expect(hayFiltrosActivos({ ...base, tipo: "equipo" })).toBe(true);
    expect(hayFiltrosActivos({ ...base, preset: "todos" })).toBe(true);
  });
});

describe("rangoDe", () => {
  it("usa el preset o las fechas del rango personalizado", () => {
    const now = new Date("2026-10-04T15:00:00Z");
    expect(rangoDe(parseFiltrosVentas({ preset: "mes" }, ver), now)).toEqual({
      desde: "2026-10-01",
      hasta: "2026-10-04",
    });
    expect(
      rangoDe(
        parseFiltrosVentas(
          { preset: "personalizado", desde: "2026-01-01", hasta: "2026-01-31" },
          ver,
        ),
        now,
      ),
    ).toEqual({ desde: "2026-01-01", hasta: "2026-01-31" });
    expect(rangoDe(parseFiltrosVentas({ preset: "todos" }, ver), now)).toEqual({
      desde: "",
      hasta: "",
    });
  });
});

describe("deltaHintDe", () => {
  it("da una leyenda acorde al preset", () => {
    expect(deltaHintDe("mes")).toContain("mes anterior");
    expect(deltaHintDe("15dias")).toContain("15 días");
    expect(deltaHintDe("todos")).toBeTruthy();
  });
});
