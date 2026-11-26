import { describe, expect, it } from "vitest";
import {
  diferenciaDeVenta,
  errorDiferencia,
  errorPrecioItem,
  precioMayoristaDe,
  precioSegunModalidad,
  preciosPermitidos,
} from "./precios";

describe("precioMayoristaDe", () => {
  it("el de la unidad gana al de la variante", () => {
    expect(precioMayoristaDe({ precioMayoristaUsd: 700 }, { precioMayoristaUsd: 750 })).toBe(700);
  });
  it("sin propio usa el de la variante; sin ninguno, null", () => {
    expect(precioMayoristaDe({ precioMayoristaUsd: null }, { precioMayoristaUsd: 750 })).toBe(750);
    expect(precioMayoristaDe({}, undefined)).toBeNull();
    expect(precioMayoristaDe({ precioMayoristaUsd: null }, { precioMayoristaUsd: null })).toBeNull();
  });
  it("0 es un precio válido, no «sin dato»", () => {
    expect(precioMayoristaDe({ precioMayoristaUsd: 0 }, { precioMayoristaUsd: 750 })).toBe(0);
  });
});

describe("precioSegunModalidad / preciosPermitidos", () => {
  it("minorista siempre el de lista", () => {
    expect(precioSegunModalidad(900, 750, "minorista")).toBe(900);
    expect(preciosPermitidos(900, 750, "minorista")).toEqual([900]);
  });
  it("mayorista usa el mayorista si hay, si no el de lista", () => {
    expect(precioSegunModalidad(900, 750, "mayorista")).toBe(750);
    expect(precioSegunModalidad(900, null, "mayorista")).toBe(900);
    expect(preciosPermitidos(900, 750, "mayorista")).toEqual([900, 750]);
  });
});

describe("errorPrecioItem", () => {
  const base = { detalle: "iPhone 15", permitidos: [900, 750] };
  it("no admin: solo los permitidos", () => {
    expect(errorPrecioItem({ ...base, pedido: 750, esAdmin: false })).toBeNull();
    expect(errorPrecioItem({ ...base, pedido: 800, esAdmin: false })).toMatch(/Solo un admin/);
  });
  it("admin: cualquier precio ≥ 0", () => {
    expect(errorPrecioItem({ ...base, pedido: 640, esAdmin: true })).toBeNull();
    expect(errorPrecioItem({ ...base, pedido: -1, esAdmin: true })).toMatch(/no es válido/);
  });
});

describe("diferencia de la venta", () => {
  it("faltante redondeado; lo que sobra no es diferencia", () => {
    expect(diferenciaDeVenta(1000, 950.004)).toBe(50);
    expect(diferenciaDeVenta(1000, 1200)).toBe(0);
  });
  it("cobro completo: sin error aunque no se acepte nada", () => {
    expect(errorDiferencia({ totalUsd: 1000, cobradoUsd: 1000, aceptadaUsd: 0 })).toBeNull();
  });
  it("faltante: solo pasa si se aceptó exactamente ese monto", () => {
    expect(errorDiferencia({ totalUsd: 1000, cobradoUsd: 950, aceptadaUsd: 50 })).toBeNull();
    expect(errorDiferencia({ totalUsd: 1000, cobradoUsd: 950, aceptadaUsd: 0 })).toMatch(/no cubren/);
    expect(errorDiferencia({ totalUsd: 1000, cobradoUsd: 900, aceptadaUsd: 50 })).toMatch(/no cubren/);
  });
  it("pagos de más: error", () => {
    expect(errorDiferencia({ totalUsd: 1000, cobradoUsd: 1100, aceptadaUsd: 0 })).toMatch(/superan/);
  });
});
