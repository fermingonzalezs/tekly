import { describe, expect, it } from "vitest";
import { diffEquipo, diffRepuesto, diffOtro } from "@/lib/inventario-diff";
import type { Equipo, OtroItem, Repuesto } from "@/lib/types";

const equipo: Equipo = {
  id: "e1",
  modelo: "iPhone 13",
  almacenamiento: "128GB",
  color: "Negro",
  imei: "123",
  bateria: 90,
  condicion: "A",
  costoUsd: 500,
  precioUsd: 700,
  estado: "disponible",
};

const repuesto: Repuesto = {
  id: "r1",
  sku: "SKU-1",
  nombre: "Pantalla",
  modelo: "iPhone 13",
  stock: 10,
  stockMin: 2,
  costoUsd: 40,
  proveedor: "ACME",
};

describe("diffEquipo", () => {
  it("sin cambios devuelve el mensaje explícito", () => {
    expect(diffEquipo(equipo, { ...equipo })).toBe("Editado (sin cambios)");
  });

  it("un solo campo cambiado", () => {
    expect(diffEquipo(equipo, { ...equipo, precioUsd: 750 })).toBe("venta U$ 700 → U$ 750");
  });

  it("formatea batería con %", () => {
    expect(diffEquipo(equipo, { ...equipo, bateria: 85 })).toContain("batería 90% → 85%");
  });

  it("varios campos cambiados se listan todos, separados por coma", () => {
    const d = diffEquipo(equipo, { ...equipo, color: "Blanco", estado: "reservado" });
    expect(d).toContain("color Negro → Blanco");
    expect(d).toContain("estado disponible → reservado");
  });
});

describe("diffRepuesto", () => {
  it("sin cambios", () => {
    expect(diffRepuesto(repuesto, { ...repuesto })).toBe("Editado (sin cambios)");
  });

  it("cambio de stock", () => {
    expect(diffRepuesto(repuesto, { ...repuesto, stock: 5 })).toContain("stock 10 → 5");
  });
});

describe("diffOtro", () => {
  const noSerializado: OtroItem = {
    id: "o1",
    nombre: "AirPods",
    categoria: "airpods",
    precioUsd: 200,
    serializado: false,
    cantidad: 5,
    costoUsd: 100,
  };

  it("sin cambios", () => {
    expect(diffOtro(noSerializado, { ...noSerializado })).toBe("Editado (sin cambios)");
  });

  it("cambio de precio y cantidad", () => {
    const d = diffOtro(noSerializado, { ...noSerializado, precioUsd: 220, cantidad: 3 });
    expect(d).toContain("venta U$ 200 → U$ 220");
    expect(d).toContain("cantidad 5 → 3");
  });

  it("serializado: no compara cantidad/costo (no existen en esa variante)", () => {
    const serA: OtroItem = {
      id: "o2",
      nombre: "iPad",
      categoria: "ipad",
      precioUsd: 500,
      serializado: true,
      unidades: [{ serial: "S1", costoUsd: 300 }],
    };
    const serB: OtroItem = { ...serA, precioUsd: 550 };
    expect(diffOtro(serA, serB)).toBe("venta U$ 500 → U$ 550");
  });
});
