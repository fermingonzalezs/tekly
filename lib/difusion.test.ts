import { describe, expect, it } from "vitest";
import {
  buildMensaje,
  copyCelular,
  copyNotebook,
  expandirEntrada,
  precioConDescuento,
  totalItems,
} from "@/lib/difusion";
import type { Celular, ListaDifusion, Notebook } from "@/lib/types";

function celular(over: Partial<Celular> = {}): Celular {
  return {
    id: "c1",
    modelo: "iPhone 13 Pro",
    almacenamiento: "256GB",
    color: "Sierra Blue",
    imei: "356789101234567",
    bateria: 92,
    condicion: "A+",
    costoUsd: 600,
    precioUsd: 780,
    estado: "disponible",
    ...over,
  };
}

function notebook(over: Partial<Notebook> = {}): Notebook {
  return {
    id: "n1",
    modelo: "MacBook Air M2",
    cpu: "Apple M2",
    memoria: "8 GB",
    almacenamiento: "256 GB SSD",
    pantalla: '13.6"',
    color: "Medianoche",
    idioma: "Español",
    numeroSerie: "SERIE-SECRETA",
    garantia: "6 meses",
    notas: "nota interna",
    costoUsd: 800,
    precioUsd: 1050,
    estado: "disponible",
    condicion: "nuevo",
    bateria: null,
    ...over,
  };
}

const lista = (over: Partial<ListaDifusion> = {}): ListaDifusion => ({
  id: "l1",
  nombre: "Disponibles",
  mensajeInicial: "🔥 DISPONIBLES 🔥",
  mensajeFinal: "",
  descuentoTipo: "ninguno",
  descuentoValor: 0,
  secciones: [],
  creadaEl: "",
  ...over,
});

describe("expandirEntrada · notebooks", () => {
  const nbs = [
    notebook({ id: "n1" }),
    notebook({ id: "n2", modelo: "MacBook Pro", condicion: "usado", bateria: 88 }),
    notebook({ id: "n3", modelo: "Vendida", estado: "vendido" }),
  ];

  it("trae solo las disponibles; sin condiciones = nuevas y usadas", () => {
    const l = expandirEntrada({ id: "r", tipo: "notebook", condiciones: [] }, [], [], nbs);
    expect(l.map((x) => x.texto)).toEqual([
      "MacBook Air M2 8 GB 256 GB SSD",
      "MacBook Pro 8 GB 256 GB SSD (usada, batería 88%)",
    ]);
  });

  it("filtra por condición", () => {
    const usadas = expandirEntrada({ id: "r", tipo: "notebook", condiciones: ["usado"] }, [], [], nbs);
    expect(usadas).toHaveLength(1);
    expect(usadas[0].precioUsd).toBe(1050);
    const nuevas = expandirEntrada({ id: "r", tipo: "notebook", condiciones: ["nuevo"] }, [], [], nbs);
    expect(nuevas).toHaveLength(1);
  });

  it("sin pasar notebooks (llamada vieja) no rompe", () => {
    expect(expandirEntrada({ id: "r", tipo: "notebook", condiciones: [] }, [], [])).toEqual([]);
  });
});

describe("buildMensaje / totalItems con notebooks", () => {
  it("arma la sección de notebooks con el precio con descuento", () => {
    const l = lista({
      descuentoTipo: "monto",
      descuentoValor: 50,
      secciones: [
        {
          id: "s1",
          nombre: "Notebooks",
          emoji: "💻",
          entradas: [{ id: "r", tipo: "notebook", condiciones: ["nuevo"] }],
        },
      ],
    });
    const msg = buildMensaje(l, [celular()], [], [notebook()]);
    expect(msg).toContain("NOTEBOOKS");
    expect(msg).toContain("💻 MacBook Air M2 8 GB 256 GB SSD - U$ 1.000");
    expect(totalItems(l, [celular()], [], [notebook()])).toBe(1);
  });

  it("el celular sigue igual (regresión)", () => {
    const l = lista({
      secciones: [
        { id: "s", nombre: "iPhone", emoji: "📱", entradas: [{ id: "r", tipo: "celular", condiciones: [] }] },
      ],
    });
    expect(buildMensaje(l, [celular()], [])).toContain("📱 iPhone 13 Pro 256GB Sierra Blue - U$ 780");
  });
});

describe("precioConDescuento", () => {
  it("porcentaje sobre la ganancia, no sobre el precio", () => {
    expect(
      precioConDescuento({ texto: "x", precioUsd: 100, costoUsd: 80 }, lista({ descuentoTipo: "porcentaje", descuentoValor: 50 })),
    ).toBe(90);
  });
});

describe("copyCelular", () => {
  it("usado: batería y estética, sin costo ni IMEI", () => {
    const t = copyCelular(celular());
    expect(t).toBe("📱 iPhone 13 Pro 256GB Sierra Blue 🔋92% - Estética: A+ - U$780");
    expect(t).not.toContain("356789101234567");
  });

  it("nuevo: sin batería ni estética", () => {
    expect(copyCelular(celular({ condicion: "NUEVO" }))).toBe(
      "📱 iPhone 13 Pro 256GB Sierra Blue - U$780",
    );
  });
});

describe("copyNotebook", () => {
  it("nueva: una línea, sin serie, costo ni notas", () => {
    const t = copyNotebook(notebook());
    expect(t).toBe('💻 MacBook Air M2 - 13.6" - Apple M2 - 256 GB SSD - 8 GB - Nuevo - Medianoche - U$1.050');
    expect(t).not.toContain("SERIE-SECRETA");
    expect(t).not.toContain("nota interna");
  });

  it("usada muestra la batería", () => {
    expect(copyNotebook(notebook({ condicion: "usado", bateria: 87 }))).toContain("Usada 🔋87%");
  });

  it("omite datos vacíos", () => {
    const t = copyNotebook(notebook({ cpu: "", memoria: "", almacenamiento: "", pantalla: "", idioma: "", garantia: "", color: "" }));
    expect(t).toBe("💻 MacBook Air M2 - Nuevo - U$1.050");
  });
});
