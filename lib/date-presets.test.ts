import { describe, expect, it } from "vitest";
import {
  contextoPeriodo,
  diasEntre,
  enRango,
  hoyISO,
  periodoAnterior,
  presetRange,
  sumarDias,
} from "@/lib/date-presets";

// 22:30 del 4 de octubre en Argentina (UTC-3) = 01:30 UTC del 5.
const NOCHE_ART = new Date("2026-10-05T01:30:00Z");
// 12:00 del 4 de octubre en Argentina.
const MEDIODIA_ART = new Date("2026-10-04T15:00:00Z");

describe("hoyISO", () => {
  it("usa la fecha de Argentina, no la de UTC (después de las 21 h)", () => {
    expect(hoyISO(NOCHE_ART)).toBe("2026-10-04");
    expect(hoyISO(MEDIODIA_ART)).toBe("2026-10-04");
  });
});

describe("presetRange", () => {
  it("'Este mes' termina hoy en hora argentina, aunque en UTC ya sea mañana", () => {
    expect(presetRange("mes", NOCHE_ART)).toEqual({ desde: "2026-10-01", hasta: "2026-10-04" });
  });

  it("'Mes anterior' es el mes completo anterior (cruza de año)", () => {
    expect(presetRange("mes_anterior", NOCHE_ART)).toEqual({ desde: "2026-09-01", hasta: "2026-09-30" });
    expect(presetRange("mes_anterior", new Date("2026-01-10T15:00:00Z"))).toEqual({
      desde: "2025-12-01",
      hasta: "2025-12-31",
    });
  });

  it("'Últimos 15 días' y los presets sin rango", () => {
    expect(presetRange("15dias", MEDIODIA_ART)).toEqual({ desde: "2026-09-19", hasta: "2026-10-04" });
    expect(presetRange("todos")).toBeNull();
    expect(presetRange("personalizado")).toBeNull();
  });
});

describe("aritmética de fechas ISO", () => {
  it("sumarDias y diasEntre cruzan meses y años", () => {
    expect(sumarDias("2026-03-01", -1)).toBe("2026-02-28");
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(diasEntre("2026-09-30", "2026-10-04")).toBe(4);
  });
});

describe("periodoAnterior", () => {
  it("'Este mes' compara contra el mismo tramo del mes anterior", () => {
    expect(periodoAnterior("mes", { desde: "2026-10-01", hasta: "2026-10-04" })).toEqual({
      desde: "2026-09-01",
      hasta: "2026-09-04",
    });
  });

  it("si el mes anterior es más corto, no se pasa de su último día", () => {
    expect(periodoAnterior("mes", { desde: "2026-03-01", hasta: "2026-03-31" })).toEqual({
      desde: "2026-02-01",
      hasta: "2026-02-28",
    });
  });

  it("'Mes anterior' compara contra el mes de antes, completo", () => {
    expect(periodoAnterior("mes_anterior", { desde: "2026-09-01", hasta: "2026-09-30" })).toEqual({
      desde: "2026-08-01",
      hasta: "2026-08-31",
    });
  });

  it("un rango de N días compara contra los N días previos", () => {
    expect(periodoAnterior("personalizado", { desde: "2026-10-01", hasta: "2026-10-10" })).toEqual({
      desde: "2026-09-21",
      hasta: "2026-09-30",
    });
    expect(periodoAnterior("15dias", { desde: "2026-09-19", hasta: "2026-10-04" })).toEqual({
      desde: "2026-09-03",
      hasta: "2026-09-18",
    });
  });

  it("sin rango (todas las fechas o abierto) no hay período anterior", () => {
    expect(periodoAnterior("todos", { desde: "", hasta: "" })).toBeNull();
    expect(periodoAnterior("personalizado", { desde: "2026-10-01", hasta: "" })).toBeNull();
  });
});

describe("contextoPeriodo", () => {
  it("mes en curso y rango que cruza de mes", () => {
    expect(contextoPeriodo("mes", { desde: "2026-10-01", hasta: "2026-10-04" })).toBe(
      "Octubre 2026 · del 1 al 4",
    );
    expect(contextoPeriodo("15dias", { desde: "2026-09-19", hasta: "2026-10-04" })).toBe(
      "del 19 sep al 4 oct de 2026",
    );
    expect(contextoPeriodo("todos", { desde: "", hasta: "" })).toBe("Toda la historia");
  });
});

describe("enRango", () => {
  it("incluye los bordes y trata un lado vacío como abierto", () => {
    const r = { desde: "2026-10-01", hasta: "2026-10-04" };
    expect(enRango("2026-10-01", r)).toBe(true);
    expect(enRango("2026-10-04T23:00:00Z", r)).toBe(true);
    expect(enRango("2026-09-30", r)).toBe(false);
    expect(enRango("2026-10-05", r)).toBe(false);
    expect(enRango("2020-01-01", { desde: "", hasta: "" })).toBe(true);
  });
});
