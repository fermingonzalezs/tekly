import { describe, expect, it } from "vitest";
import { normalizarNombreTienda, resolverTienda } from "./tiendas";

const tiendas = [{ id: "t1", nombre: "Heavenstore" }];

describe("resolverTienda", () => {
  it("sin elección o principal → principal", () => {
    expect(resolverTienda(undefined, tiendas, "Hellstore")).toEqual({ ok: true, accion: "principal" });
    expect(resolverTienda({ tipo: "principal" }, tiendas, "Hellstore")).toEqual({
      ok: true,
      accion: "principal",
    });
  });

  it("existente: usa la de la lista y rechaza un id ajeno", () => {
    expect(resolverTienda({ tipo: "existente", id: "t1" }, tiendas, "Hellstore")).toEqual({
      ok: true,
      accion: "usar",
      id: "t1",
      nombre: "Heavenstore",
    });
    expect(resolverTienda({ tipo: "existente", id: "x" }, tiendas, "Hellstore").ok).toBe(false);
  });

  it("nueva: crea, o reusa si ya existe con otro formato, o es la principal", () => {
    expect(resolverTienda({ tipo: "nueva", nombre: " Purgatory  Store " }, tiendas, "Hellstore")).toEqual({
      ok: true,
      accion: "crear",
      nombre: "Purgatory Store",
    });
    expect(resolverTienda({ tipo: "nueva", nombre: "heavenSTORE" }, tiendas, "Hellstore")).toMatchObject({
      accion: "usar",
      id: "t1",
    });
    expect(resolverTienda({ tipo: "nueva", nombre: "hellstore " }, tiendas, "Hellstore")).toEqual({
      ok: true,
      accion: "principal",
    });
  });

  it("nueva: vacía o demasiado larga es error", () => {
    expect(resolverTienda({ tipo: "nueva", nombre: "  " }, tiendas, "Hellstore").ok).toBe(false);
    expect(resolverTienda({ tipo: "nueva", nombre: "x".repeat(61) }, tiendas, "Hellstore").ok).toBe(false);
  });

  it("normaliza espacios", () => {
    expect(normalizarNombreTienda("  a   b ")).toBe("a b");
  });
});
