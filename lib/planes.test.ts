import { describe, expect, it } from "vitest";
import {
  cupoUsuarios,
  estadoDeAcceso,
  puedeEscribir,
  type Suscripcion,
} from "./planes";

const AHORA = new Date("2026-10-11T12:00:00Z");
const base: Suscripcion = {
  plan: "trial",
  estado: "trial",
  trialTerminaAt: "2026-10-25T12:00:00Z",
  periodoTerminaAt: null,
};

describe("estadoDeAcceso", () => {
  it("prueba en curso cuenta los días que faltan", () => {
    expect(estadoDeAcceso(base, AHORA)).toEqual({ modo: "trial", diasRestantes: 14 });
  });

  it("el último día de prueba sigue siendo trial", () => {
    const s = { ...base, trialTerminaAt: "2026-10-11T18:00:00Z" };
    expect(estadoDeAcceso(s, AHORA)).toEqual({ modo: "trial", diasRestantes: 1 });
  });

  it("prueba vencida pasa a solo lectura", () => {
    const s = { ...base, trialTerminaAt: "2026-10-11T11:00:00Z" };
    expect(estadoDeAcceso(s, AHORA)).toEqual({ modo: "solo_lectura", motivo: "trial_vencido" });
    expect(puedeEscribir(s, AHORA)).toBe(false);
  });

  it("plan activo sin fin de período no vence", () => {
    const s: Suscripcion = { ...base, plan: "business", estado: "activo" };
    expect(estadoDeAcceso(s, AHORA)).toEqual({ modo: "ok", diasRestantes: null });
  });

  it("plan activo vencido tiene 3 días de gracia", () => {
    const s: Suscripcion = {
      ...base,
      plan: "business",
      estado: "activo",
      periodoTerminaAt: "2026-10-09T12:00:00Z",
    };
    expect(puedeEscribir(s, AHORA)).toBe(true);
    const viejo = { ...s, periodoTerminaAt: "2026-10-07T11:00:00Z" };
    expect(estadoDeAcceso(viejo, AHORA)).toEqual({
      modo: "solo_lectura",
      motivo: "periodo_vencido",
    });
  });

  it("vencido y cancelado son solo lectura", () => {
    expect(puedeEscribir({ ...base, estado: "vencido" }, AHORA)).toBe(false);
    expect(estadoDeAcceso({ ...base, plan: "starter", estado: "cancelado" }, AHORA)).toEqual({
      modo: "solo_lectura",
      motivo: "cancelado",
    });
  });
});

describe("cupoUsuarios", () => {
  it("Starter 1, Business 3, Business+ 10", () => {
    expect(cupoUsuarios("starter", 1).max).toBe(1);
    expect(cupoUsuarios("business", 0).max).toBe(3);
    expect(cupoUsuarios("business_plus", 0).max).toBe(10);
  });

  it("lleno cuando usados alcanza el máximo", () => {
    expect(cupoUsuarios("business", 3)).toEqual({ max: 3, usados: 3, disponibles: 0, lleno: true });
    expect(cupoUsuarios("business", 2).lleno).toBe(false);
  });
});
