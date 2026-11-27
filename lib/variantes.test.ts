import { describe, expect, it } from "vitest";
import {
  agruparPorGrupo,
  condicionLabel,
  buscarVariante,
  camposDesdeVariante,
  claveVariante,
  cruzoMinimo,
  nombreVariante,
  precioPropioPorDefecto,
  normalizar,
  normalizarAlmacenamiento,
  ordenarGrupos,
  precioModa,
  rangoPrecio,
  skuSugerido,
  stockDeVariante,
  variantesBajoMinimo,
} from "./variantes";
import type { Celular, Variante } from "@/lib/types";

function variante(partial: Partial<Variante> & { id: string }): Variante {
  return {
    categoria: "celular",
    memoria: "",
    pantalla: "",
    grupo: "iPhone 15",
    sku: "IPHONE-15-128GB-A",
    modelo: "iPhone 15",
    almacenamiento: "128 GB",
    condicion: "A",
    color: "",
    precioUsd: 700,
    stockMinimo: 0,
    activa: true,
    ...partial,
  };
}

function celular(partial: Partial<Celular> & { id: string }): Celular {
  return {
    modelo: "iPhone 15",
    almacenamiento: "128 GB",
    color: "Negro",
    imei: "1",
    bateria: 90,
    condicion: "A",
    costoUsd: 500,
    precioUsd: 700,
    estado: "disponible",
    varianteId: "v1",
    precioPropio: false,
    ...partial,
  };
}

describe("normalizar", () => {
  it("ignora mayúsculas, tildes y espacios de más", () => {
    expect(normalizar("  iPhone  15  ")).toBe("iphone 15");
    expect(normalizar("Batería Ñandú")).toBe("bateria nandu");
  });

  it("el almacenamiento ignora los espacios", () => {
    expect(normalizarAlmacenamiento("128 GB")).toBe(normalizarAlmacenamiento("128gb"));
  });
});

describe("claveVariante", () => {
  it("usa modelo|almacenamiento|condición|color normalizados", () => {
    expect(
      claveVariante({ modelo: " iPhone 15 ", almacenamiento: "128GB", condicion: "a", color: "" }),
    ).toBe("iphone 15|128gb|A|");
  });

  it("distingue una variante con color de la de cualquier color", () => {
    const base = { modelo: "iPhone 15", almacenamiento: "128 GB", condicion: "A" };
    expect(claveVariante({ ...base, color: "Negro" })).not.toBe(
      claveVariante({ ...base, color: "" }),
    );
  });
});

describe("buscarVariante", () => {
  const sinColor = variante({ id: "v1", sku: "IPHONE-15-128GB-A" });
  const negro = variante({ id: "v2", sku: "IPHONE-15-128GB-A-NEGRO", color: "Negro" });
  const datos = { modelo: "iPhone 15", almacenamiento: "128 GB", condicion: "A" };

  it("prefiere la variante con el color de la unidad", () => {
    expect(buscarVariante([sinColor, negro], { ...datos, color: "Negro" })?.id).toBe("v2");
  });

  it("cae a la de cualquier color si no hay una con ese color", () => {
    expect(buscarVariante([sinColor, negro], { ...datos, color: "Azul" })?.id).toBe("v1");
  });

  it("no devuelve variantes desactivadas", () => {
    expect(buscarVariante([{ ...sinColor, activa: false }], { ...datos, color: "Azul" })).toBeUndefined();
  });

  it("normaliza mayúsculas y espacios", () => {
    expect(
      buscarVariante([sinColor], { modelo: "  IPHONE 15 ", almacenamiento: "128gb", condicion: "a", color: "" })
        ?.id,
    ).toBe("v1");
  });
});

describe("skuSugerido", () => {
  const datos = { modelo: "iPhone 15 Pro", almacenamiento: "128 GB", condicion: "A", color: "" };

  it("arma un slug legible", () => {
    expect(skuSugerido(datos, [])).toBe("IPHONE-15-PRO-128GB-USADO");
  });

  it("agrega el color cuando la variante lo tiene", () => {
    expect(skuSugerido({ ...datos, color: "Negro" }, [])).toBe("IPHONE-15-PRO-128GB-USADO-NEGRO");
  });

  it("desambigua con -2, -3…", () => {
    expect(skuSugerido(datos, ["IPHONE-15-PRO-128GB-USADO"])).toBe("IPHONE-15-PRO-128GB-USADO-2");
    expect(
      skuSugerido(datos, ["IPHONE-15-PRO-128GB-USADO", "iphone-15-pro-128gb-usado-2"]),
    ).toBe("IPHONE-15-PRO-128GB-USADO-3");
  });

  it("la condición va solo como NUEVO o USADO", () => {
    expect(skuSugerido({ ...datos, condicion: "nuevo" }, [])).toBe("IPHONE-15-PRO-128GB-NUEVO");
    expect(skuSugerido({ ...datos, condicion: "A+" }, [])).toBe("IPHONE-15-PRO-128GB-USADO");
    expect(skuSugerido({ ...datos, condicion: "" }, [])).toBe("IPHONE-15-PRO-128GB");
  });

  it("no deja guiones sueltos ni tildes", () => {
    expect(skuSugerido({ modelo: "Ñandú / X", almacenamiento: "", condicion: "B+", color: "" }, [])).toBe(
      "NANDU-X-USADO",
    );
  });
});

describe("camposDesdeVariante", () => {
  it("copia los datos clave y el color (vacío = el de la unidad)", () => {
    expect(camposDesdeVariante(variante({ id: "v1", color: "" }))).toEqual({
      categoria: "celular",
      memoria: "",
      pantalla: "",
      modelo: "iPhone 15",
      almacenamiento: "128 GB",
      condicion: "A",
      color: "",
    });
  });
});

describe("nombreVariante", () => {
  it("une los datos con ·", () => {
    expect(nombreVariante(variante({ id: "v1", color: "Negro" }))).toBe(
      "iPhone 15 · 128 GB · A · Negro",
    );
  });

  it("aclara «Cualquier color» solo cuando se pide", () => {
    expect(nombreVariante(variante({ id: "v1" }))).toBe("iPhone 15 · 128 GB · A");
    expect(nombreVariante(variante({ id: "v1" }), { cualquierColor: true })).toBe(
      "iPhone 15 · 128 GB · A · Cualquier color",
    );
  });
});

describe("agruparPorGrupo / ordenarGrupos", () => {
  it("junta variantes con el mismo grupo aunque cambie el modelo", () => {
    const grupos = agruparPorGrupo([
      variante({ id: "v1", grupo: "iPhone 15", modelo: "iPhone 15" }),
      variante({ id: "v2", grupo: " iphone  15 ", modelo: "iPhone 15 Pro" }),
      variante({ id: "v3", grupo: "iPhone 13", modelo: "iPhone 13" }),
    ]);
    expect(grupos).toHaveLength(2);
    expect(grupos.find((g) => g.clave === "iphone 15")?.variantes).toHaveLength(2);
  });

  it("ordena alfabéticamente", () => {
    const orden = ordenarGrupos(
      agruparPorGrupo([
        variante({ id: "v1", grupo: "Samsung" }),
        variante({ id: "v2", grupo: "iPhone" }),
        variante({ id: "v3", grupo: "Alcatel" }),
      ]),
    ).map((g) => g.grupo);
    expect(orden).toEqual(["Alcatel", "iPhone", "Samsung"]);
  });
});

describe("stockDeVariante", () => {
  it("cuenta por estado y no mezcla variantes", () => {
    const stock = stockDeVariante(variante({ id: "v1" }), [
      celular({ id: "c1", estado: "disponible" }),
      celular({ id: "c2", estado: "disponible" }),
      celular({ id: "c3", estado: "reservado" }),
      celular({ id: "c4", estado: "en_revision" }),
      celular({ id: "c5", estado: "vendido" }),
      celular({ id: "c6", varianteId: "v2" }),
    ]);
    expect(stock).toEqual({ disponibles: 2, reservadas: 1, enRevision: 1 });
  });
});

describe("rangoPrecio", () => {
  it("toma el mínimo y máximo de las unidades no vendidas", () => {
    expect(
      rangoPrecio(variante({ id: "v1", precioUsd: 700 }), [
        celular({ id: "c1", precioUsd: 800 }),
        celular({ id: "c2", precioUsd: 650 }),
        celular({ id: "c3", precioUsd: 999, estado: "vendido" }),
      ]),
    ).toEqual([650, 800]);
  });

  it("sin unidades usa el precio de la variante", () => {
    expect(rangoPrecio(variante({ id: "v1", precioUsd: 700 }), [])).toEqual([700, 700]);
  });
});

describe("precioModa", () => {
  it("devuelve el más frecuente", () => {
    expect(precioModa([700, 700, 800])).toBe(700);
  });

  it("desempata por el mayor", () => {
    expect(precioModa([700, 800])).toBe(800);
  });

  it("sin precios devuelve 0", () => {
    expect(precioModa([])).toBe(0);
  });
});

describe("variantesBajoMinimo", () => {
  const unidades = [
    celular({ id: "c1", varianteId: "v1" }),
    celular({ id: "c2", varianteId: "v1", estado: "vendido" }),
  ];

  it("marca las activas por debajo del mínimo", () => {
    expect(
      variantesBajoMinimo([variante({ id: "v1", stockMinimo: 2 })], unidades).map((v) => v.id),
    ).toEqual(["v1"]);
  });

  it("0 = sin aviso y las desactivadas no cuentan", () => {
    expect(variantesBajoMinimo([variante({ id: "v1", stockMinimo: 0 })], unidades)).toEqual([]);
    expect(
      variantesBajoMinimo([variante({ id: "v1", stockMinimo: 5, activa: false })], unidades),
    ).toEqual([]);
  });
});

describe("cruzoMinimo", () => {
  it("solo cuando baja del mínimo en este cambio", () => {
    expect(cruzoMinimo(2, 1, 2)).toBe(true);
    expect(cruzoMinimo(1, 0, 2)).toBe(false);
    expect(cruzoMinimo(3, 2, 2)).toBe(false);
    expect(cruzoMinimo(2, 1, 0)).toBe(false);
  });
});

describe("variantes de notebooks", () => {
  const datos = {
    categoria: "notebook" as const,
    modelo: "MacBook Air M2",
    memoria: "16 GB",
    almacenamiento: "512GB",
    pantalla: '13.6"',
    condicion: "usado",
    color: "Gris",
  };

  it("la clave es modelo|memoria|almacenamiento|pantalla|CONDICIÓN, sin color", () => {
    expect(claveVariante(datos)).toBe("macbook air m2|16gb|512gb|13.6|USADO");
    expect(claveVariante({ ...datos, pantalla: "13,6 pulgadas" })).toBe(claveVariante(datos));
    expect(claveVariante({ ...datos, pantalla: "15.3''" })).not.toBe(claveVariante(datos));
    expect(claveVariante({ ...datos, color: "" })).toBe(claveVariante(datos));
    expect(claveVariante({ ...datos, memoria: "8GB" })).not.toBe(claveVariante(datos));
  });

  it("SKU con memoria y NUEVO/USADO, sin color", () => {
    expect(skuSugerido(datos, [])).toBe("MACBOOK-AIR-M2-16GB-512GB-13-6-USADO");
    expect(skuSugerido({ ...datos, condicion: "nuevo" }, [])).toBe(
      "MACBOOK-AIR-M2-16GB-512GB-13-6-NUEVO",
    );
    expect(skuSugerido(datos, ["MACBOOK-AIR-M2-16GB-512GB-13-6-USADO"])).toBe(
      "MACBOOK-AIR-M2-16GB-512GB-13-6-USADO-2",
    );
    expect(
      skuSugerido({ ...datos, modelo: "", memoria: "", almacenamiento: "", pantalla: "", condicion: "" }, []),
    ).toBe(
      "NOTEBOOK",
    );
  });

  it("buscarVariante no mezcla categorías", () => {
    const nb = variante({
      id: "n1",
      categoria: "notebook",
      modelo: "MacBook Air M2",
      memoria: "16GB",
      almacenamiento: "512 GB",
      pantalla: "13.6''",
      condicion: "usado",
    });
    const cel = variante({ id: "c1" });
    expect(buscarVariante([cel, nb], datos)?.id).toBe("n1");
    expect(
      buscarVariante([nb], { modelo: "iPhone 15", almacenamiento: "128 GB", condicion: "A", color: "" }),
    ).toBeUndefined();
  });

  it("una variante sin pantalla (vieja) sirve para cualquier pantalla", () => {
    const vieja = variante({
      id: "n0",
      categoria: "notebook",
      modelo: "MacBook Air M2",
      memoria: "16GB",
      almacenamiento: "512GB",
      condicion: "usado",
    });
    const con = variante({ ...vieja, id: "n1", pantalla: '13.6"' });
    expect(buscarVariante([vieja, con], datos)?.id).toBe("n1");
    expect(buscarVariante([vieja], datos)?.id).toBe("n0");
    expect(buscarVariante([con], { ...datos, pantalla: '15.3"' })).toBeUndefined();
  });

  it("los usados arrancan con precio propio", () => {
    expect(precioPropioPorDefecto(variante({ id: "a", condicion: "A+" }))).toBe(true);
    expect(precioPropioPorDefecto(variante({ id: "b", condicion: "NUEVO" }))).toBe(false);
    expect(precioPropioPorDefecto(variante({ id: "c", categoria: "notebook", condicion: "usado" }))).toBe(true);
    expect(precioPropioPorDefecto(variante({ id: "d", categoria: "notebook", condicion: "nuevo" }))).toBe(false);
    expect(precioPropioPorDefecto(null)).toBe(false);
  });

  it("nombre legible con la condición capitalizada", () => {
    const nb = variante({
      id: "n1",
      categoria: "notebook",
      modelo: "MacBook Air M2",
      memoria: "16 GB",
      almacenamiento: "512 GB",
      pantalla: '13.6"',
      condicion: "nuevo",
    });
    expect(nombreVariante(nb)).toBe('MacBook Air M2 · 16 GB · 512 GB · 13.6" · Nuevo');
    expect(condicionLabel("usado")).toBe("Usado");
    expect(condicionLabel("A+")).toBe("A+");
  });
});
