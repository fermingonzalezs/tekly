import { describe, expect, it } from "vitest";
import {
  parseFiltrosAnaliticas,
  queryDeAnaliticas,
  rangoDe,
} from "@/lib/analiticas-filtros";

describe("parseFiltrosAnaliticas", () => {
  it("sin params usa los defaults", () => {
    expect(parseFiltrosAnaliticas({})).toEqual({
      tab: "ventas",
      preset: "mes",
      desde: "",
      hasta: "",
    });
  });

  it("tab y preset inválidos caen al default", () => {
    const f = parseFiltrosAnaliticas({ tab: "hack", preset: "nope" });
    expect(f.tab).toBe("ventas");
    expect(f.preset).toBe("mes");
  });

  it("personalizado sin fechas sigue siendo personalizado (rango abierto): hace falta para que aparezcan los campos de fecha", () => {
    expect(parseFiltrosAnaliticas({ preset: "personalizado" })).toEqual({
      tab: "ventas",
      preset: "personalizado",
      desde: "",
      hasta: "",
    });
  });

  it("una fecha inválida se descarta; la otra se conserva", () => {
    expect(
      parseFiltrosAnaliticas({
        preset: "personalizado",
        desde: "2026-01-01",
        hasta: "ayer",
      }),
    ).toMatchObject({ preset: "personalizado", desde: "2026-01-01", hasta: "" });
  });

  it("desde > hasta se intercambian", () => {
    const f = parseFiltrosAnaliticas({
      preset: "personalizado",
      desde: "2026-03-10",
      hasta: "2026-03-01",
    });
    expect(f.desde).toBe("2026-03-01");
    expect(f.hasta).toBe("2026-03-10");
  });

  it("toma el primer valor de un param repetido", () => {
    expect(parseFiltrosAnaliticas({ tab: ["finanzas", "ventas"] }).tab).toBe(
      "finanzas",
    );
  });
});

describe("queryDeAnaliticas", () => {
  it("omite los defaults", () => {
    expect(
      queryDeAnaliticas({ tab: "ventas", preset: "mes", desde: "", hasta: "" }),
    ).toBe("");
  });

  it("hace round-trip", () => {
    const original = {
      tab: "finanzas" as const,
      preset: "personalizado" as const,
      desde: "2026-01-01",
      hasta: "2026-01-31",
    };
    const qs = queryDeAnaliticas(original);
    const params = Object.fromEntries(new URLSearchParams(qs));
    expect(parseFiltrosAnaliticas(params)).toEqual(original);
  });
});

describe("rangoDe", () => {
  it("usa el preset o las fechas personalizadas", () => {
    const now = new Date("2026-10-04T15:00:00Z");
    expect(
      rangoDe({ tab: "ventas", preset: "mes", desde: "", hasta: "" }, now),
    ).toEqual({ desde: "2026-10-01", hasta: "2026-10-04" });
    expect(
      rangoDe(
        {
          tab: "ventas",
          preset: "personalizado",
          desde: "2026-01-01",
          hasta: "2026-01-31",
        },
        now,
      ),
    ).toEqual({ desde: "2026-01-01", hasta: "2026-01-31" });
  });
});
