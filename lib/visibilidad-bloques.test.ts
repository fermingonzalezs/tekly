import { describe, expect, it } from "vitest";
import {
  guardarVisibilidad,
  leerVisibilidad,
  parseVisibilidad,
  visibilidadKey,
  type StorageLike,
} from "@/lib/visibilidad-bloques";

function fakeStorage(initial: Record<string, string> = {}): StorageLike & {
  data: Record<string, string>;
} {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

describe("parseVisibilidad", () => {
  it("sin dato devuelve ambos visibles", () => {
    expect(parseVisibilidad(null)).toEqual({ graficos: true, tarjetas: true });
  });

  it("JSON roto cae al default", () => {
    expect(parseVisibilidad("{no es json")).toEqual({
      graficos: true,
      tarjetas: true,
    });
  });

  it("respeta los booleanos guardados", () => {
    expect(parseVisibilidad('{"graficos":false,"tarjetas":false}')).toEqual({
      graficos: false,
      tarjetas: false,
    });
  });

  it("ignora valores no booleanos por bloque", () => {
    expect(parseVisibilidad('{"graficos":"no","tarjetas":false}')).toEqual({
      graficos: true,
      tarjetas: false,
    });
  });
});

describe("leerVisibilidad / guardarVisibilidad", () => {
  it("sin storage devuelve el default", () => {
    expect(leerVisibilidad("ventas", null)).toEqual({
      graficos: true,
      tarjetas: true,
    });
  });

  it("hace round-trip por id", () => {
    const store = fakeStorage();
    guardarVisibilidad("ventas", { graficos: false, tarjetas: true }, store);
    expect(store.data[visibilidadKey("ventas")]).toBe(
      '{"graficos":false,"tarjetas":true}',
    );
    expect(leerVisibilidad("ventas", store)).toEqual({
      graficos: false,
      tarjetas: true,
    });
  });

  it("cada id tiene su propio estado", () => {
    const store = fakeStorage();
    guardarVisibilidad("ventas", { graficos: false, tarjetas: false }, store);
    expect(leerVisibilidad("compras", store)).toEqual({
      graficos: true,
      tarjetas: true,
    });
  });

  it("no lanza si getItem falla", () => {
    const store: StorageLike = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {},
    };
    expect(leerVisibilidad("ventas", store)).toEqual({
      graficos: true,
      tarjetas: true,
    });
  });

  it("no lanza si setItem falla", () => {
    const store: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() =>
      guardarVisibilidad("ventas", { graficos: false, tarjetas: false }, store),
    ).not.toThrow();
  });
});
