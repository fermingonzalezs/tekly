import { describe, expect, it } from "vitest";
import { demografiaClientes } from "@/lib/clientes";

describe("demografiaClientes", () => {
  const hoy = new Date(2026, 8, 14); // 14 sep 2026

  it("clientes sin fechaNacimiento no cuentan (ni para el total)", () => {
    // Sin dato + uno de 26 años (2000-01-01) -> el % del que sí tiene dato
    // tiene que salir 100%, no dividido entre los 2.
    const out = demografiaClientes(
      [{ desdeISO: "2026-01-01" }, { fechaNacimiento: "2000-01-01", desdeISO: "2026-01-01" }],
      hoy,
    );
    expect(out.historico.find((r) => r.rango === "25–34")?.pct).toBe(100);
    expect(out.historico.filter((r) => r.pct > 0)).toHaveLength(1);
  });

  it("con cero clientes con dato, todos los rangos dan 0 (no NaN)", () => {
    const out = demografiaClientes([{ desdeISO: "2026-01-01" }], hoy);
    expect(out.historico.every((r) => r.pct === 0)).toBe(true);
  });

  it("calcula la edad correctamente contra `hoy`", () => {
    // 2026-09-14 menos 30 años = 1996-09-14 -> cumple hoy mismo, ya tiene 30.
    const out = demografiaClientes(
      [{ fechaNacimiento: "1996-09-15", desdeISO: "2026-01-01" }], // cumple mañana -> 29
      hoy,
    );
    expect(out.historico.find((r) => r.rango === "25–34")?.pct).toBe(100);
  });

  it("agrupa por rango y calcula % sobre el total con dato", () => {
    const clientes = [
      { fechaNacimiento: "2005-01-01", desdeISO: "2026-01-01" }, // 21
      { fechaNacimiento: "2005-01-01", desdeISO: "2026-01-01" }, // 21
      { fechaNacimiento: "1990-01-01", desdeISO: "2026-01-01" }, // 36
      { fechaNacimiento: "1960-01-01", desdeISO: "2026-01-01" }, // 66
    ];
    const out = demografiaClientes(clientes, hoy);
    expect(out.historico).toEqual([
      { rango: "18–24", pct: 50 },
      { rango: "25–34", pct: 0 },
      { rango: "35–44", pct: 25 },
      { rango: "45–54", pct: 0 },
      { rango: "55+", pct: 25 },
    ]);
  });

  it("\"mes\"/\"semana\" filtran por `desdeISO`, no por edad", () => {
    const clientes = [
      { fechaNacimiento: "2005-01-01", desdeISO: "2026-09-10" }, // 21 años, esta semana y este mes
      { fechaNacimiento: "1970-01-01", desdeISO: "2026-01-01" }, // histórico solamente
    ];
    const out = demografiaClientes(clientes, hoy);
    expect(out.mes.find((r) => r.rango === "18–24")?.pct).toBe(100);
    expect(out.semana.find((r) => r.rango === "18–24")?.pct).toBe(100);
    expect(out.historico.find((r) => r.rango === "18–24")?.pct).toBe(50);
  });
});

import { fechaDDMMAAAAaIso, isoAFechaDDMMAAAA, maskFechaDDMMAAAA } from "./clientes";

describe("fecha de nacimiento DD/MM/AAAA", () => {
  it("enmascara mientras se escribe", () => {
    expect(maskFechaDDMMAAAA("15052000")).toBe("15/05/2000");
    expect(maskFechaDDMMAAAA("15/5")).toBe("15/5");
    expect(maskFechaDDMMAAAA("1505a")).toBe("15/05");
  });
  it("convierte a ISO solo si está completa y es plausible", () => {
    expect(fechaDDMMAAAAaIso("15/05/2000")).toBe("2000-05-15");
    expect(fechaDDMMAAAAaIso("15/05")).toBeUndefined();
    expect(fechaDDMMAAAAaIso("32/01/2000")).toBeUndefined();
    expect(fechaDDMMAAAAaIso("01/13/2000")).toBeUndefined();
  });
  it("ISO a DD/MM/AAAA", () => {
    expect(isoAFechaDDMMAAAA("2000-05-15")).toBe("15/05/2000");
    expect(isoAFechaDDMMAAAA(undefined)).toBe("");
  });
});

import { BORRADOR_CLIENTE_VACIO, datosDeBorrador, validarBorradorCliente } from "./clientes";

describe("borrador de cliente", () => {
  it("solo el nombre es obligatorio", () => {
    expect(validarBorradorCliente(BORRADOR_CLIENTE_VACIO).valido).toBe(false);
    expect(validarBorradorCliente({ ...BORRADOR_CLIENTE_VACIO, nombre: "Ana" }).valido).toBe(true);
  });
  it("valida Instagram y fecha si se cargaron", () => {
    const b = { ...BORRADOR_CLIENTE_VACIO, nombre: "Ana", instagram: "mal usuario", nacimiento: "15/05" };
    const r = validarBorradorCliente(b);
    expect(r.valido).toBe(false);
    expect(r.errores.instagram).not.toBeNull();
    expect(r.errores.nacimiento).not.toBeNull();
  });
  it("datos listos para guardar", () => {
    expect(
      datosDeBorrador({
        nombre: " Ana Pérez ",
        telefono: "",
        email: "ana@mail.com",
        instagram: "https://instagram.com/Ana.Perez?igsh=x",
        nacimiento: "15/05/2000",
      }),
    ).toEqual({
      nombre: "Ana Pérez",
      telefono: undefined,
      email: "ana@mail.com",
      instagram: "ana.perez",
      fechaNacimiento: "2000-05-15",
    });
  });
});
