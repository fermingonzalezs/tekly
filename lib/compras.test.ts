import { describe, expect, it } from "vitest";
import {
  costoFinalUnitario,
  erroresCompraStock,
  prorratearCostos,
  resumenCompraStock,
  snapshotItems,
  type ItemCompraStock,
  gastoPorMes,
  gastoPorProveedor,
  resumenCompras,
  etiquetaMes,
  mesDe,
  TOP_PROVEEDORES,
} from "@/lib/compras";
import type { Compra } from "@/lib/types";

function compra(extra: Partial<Compra>): Compra {
  return {
    id: "C-1",
    fecha: "",
    fechaISO: "2026-09-07",
    origen: "proveedor",
    items: [],
    totalUsd: 0,
    medioPago: "transferencia",
    estado: "pendiente",
    ...extra,
  };
}

describe("mesDe / etiquetaMes", () => {
  it("recorta el mes de una fecha ISO", () => {
    expect(mesDe("2026-09-07")).toBe("2026-09");
  });

  it("arma la etiqueta corta", () => {
    expect(etiquetaMes("2026-09")).toBe("sep 26");
  });
});

describe("gastoPorMes", () => {
  it("sin compras devuelve lista vacía", () => {
    expect(gastoPorMes([])).toEqual([]);
  });

  it("agrupa por mes, incluye meses intermedios en 0 y ordena cronológico", () => {
    const rows = gastoPorMes([
      compra({ fechaISO: "2026-07-10", totalUsd: 100 }),
      compra({ fechaISO: "2026-09-02", totalUsd: 50 }),
      compra({ fechaISO: "2026-09-20", totalUsd: 25 }),
    ]);
    expect(rows).toEqual([
      { label: "jul 26", value: 100 },
      { label: "ago 26", value: 0 },
      { label: "sep 26", value: 75 },
    ]);
  });

  it("cruza el cambio de año sin saltear meses", () => {
    const rows = gastoPorMes([
      compra({ fechaISO: "2025-11-30", totalUsd: 10 }),
      compra({ fechaISO: "2026-02-01", totalUsd: 20 }),
    ]);
    expect(rows.map((r) => r.label)).toEqual([
      "nov 25",
      "dic 25",
      "ene 26",
      "feb 26",
    ]);
    expect(rows.reduce((a, r) => a + r.value, 0)).toBe(30);
  });
});

describe("gastoPorProveedor", () => {
  it("suma por proveedor, ordena desc y recorta al top", () => {
    const compras = Array.from({ length: TOP_PROVEEDORES + 2 }, (_, i) =>
      compra({ proveedor: `Prov ${i}`, totalUsd: i + 1 }),
    );
    const rows = gastoPorProveedor(compras);
    expect(rows).toHaveLength(TOP_PROVEEDORES);
    expect(rows[0]).toEqual({ label: `Prov ${TOP_PROVEEDORES + 1}`, value: TOP_PROVEEDORES + 2 });
    expect(rows[0].value).toBeGreaterThan(rows[1].value);
  });

  it("usa el cliente cuando la compra es un canje", () => {
    const rows = gastoPorProveedor([
      compra({ origen: "canje", cliente: "Ana", totalUsd: 300 }),
      compra({ proveedor: "Tecno", totalUsd: 100 }),
    ]);
    expect(rows).toEqual([
      { label: "Ana", value: 300 },
      { label: "Tecno", value: 100 },
    ]);
  });

  it("agrupa la contraparte vacía como 'Sin proveedor'", () => {
    const rows = gastoPorProveedor([compra({ totalUsd: 40 })]);
    expect(rows).toEqual([{ label: "Sin proveedor", value: 40 }]);
  });
});

describe("resumenCompras", () => {
  it("cuenta cantidad, pendientes, recibidas y promedio", () => {
    const r = resumenCompras([
      compra({ totalUsd: 100, estado: "pendiente" }),
      compra({ totalUsd: 200, estado: "recibida" }),
      compra({ totalUsd: 300, estado: "recibida" }),
    ]);
    expect(r).toEqual({
      cantidad: 3,
      gastadoUsd: 600,
      pendientes: 1,
      recibidas: 2,
      ticketPromedioUsd: 200,
    });
  });

  it("sin compras el promedio no divide por cero", () => {
    expect(resumenCompras([])).toEqual({
      cantidad: 0,
      gastadoUsd: 0,
      pendientes: 0,
      recibidas: 0,
      ticketPromedioUsd: 0,
    });
  });
});

const celular = (imei: string, costoUsd = 500, varianteId = "v1"): ItemCompraStock => ({
  tipo: "celular",
  detalle: "iPhone 13 128GB",
  cantidad: 1,
  costoUsd,
  celular: {
    varianteId,
    modelo: "iPhone 13",
    almacenamiento: "128GB",
    color: "Negro",
    imei,
    bateria: 90,
    condicion: "A",
    costoUsd,
    precioUsd: 700,
    estado: "en_revision",
    precioPropio: false,
  },
});

describe("prorratearCostos", () => {
  it("reparte en proporción al subtotal y suma exacto", () => {
    const partes = prorratearCostos(
      [
        { cantidad: 1, costoUsd: 300 },
        { cantidad: 1, costoUsd: 600 },
        { cantidad: 3, costoUsd: 100 },
      ],
      100,
    );
    expect(partes).toEqual([25, 50, 25]);
    expect(partes.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("manda el resto del redondeo a la línea más cara", () => {
    const partes = prorratearCostos(
      [
        { cantidad: 1, costoUsd: 1 },
        { cantidad: 1, costoUsd: 1 },
        { cantidad: 1, costoUsd: 2 },
      ],
      0.1,
    );
    expect(Math.round(partes.reduce((a, b) => a + b, 0) * 100)).toBe(10);
    expect(partes[2]).toBeGreaterThanOrEqual(partes[0]);
  });

  it("sin adicional o sin líneas devuelve ceros", () => {
    expect(prorratearCostos([{ cantidad: 1, costoUsd: 10 }], 0)).toEqual([0]);
    expect(prorratearCostos([], 50)).toEqual([]);
  });

  it("con todo en costo 0 reparte por unidades", () => {
    expect(
      prorratearCostos(
        [
          { cantidad: 1, costoUsd: 0 },
          { cantidad: 3, costoUsd: 0 },
        ],
        40,
      ),
    ).toEqual([10, 30]);
  });
});

describe("costoFinalUnitario / resumen / snapshot", () => {
  it("suma la parte del adicional dividida por la cantidad", () => {
    expect(costoFinalUnitario({ cantidad: 4, costoUsd: 10 }, 2)).toBe(10.5);
  });

  it("resumen = subtotal + adicional", () => {
    expect(
      resumenCompraStock(
        [
          { cantidad: 2, costoUsd: 100 },
          { cantidad: 1, costoUsd: 50.5 },
        ],
        20,
      ),
    ).toEqual({ subtotalUsd: 250.5, adicionalUsd: 20, totalUsd: 270.5 });
  });

  it("el snapshot guarda el costo unitario ya prorrateado", () => {
    const snap = snapshotItems([celular("1", 300), celular("2", 600)], 90);
    expect(snap.map((s) => s.costoUsd)).toEqual([330, 660]);
  });
});

describe("erroresCompraStock", () => {
  it("compra vacía", () => {
    expect(erroresCompraStock([])).toHaveLength(1);
  });

  it("IMEI repetido en la compra o ya en stock", () => {
    expect(erroresCompraStock([celular("111"), celular("111")])).toHaveLength(1);
    expect(erroresCompraStock([celular("222")], ["222"])).toHaveLength(1);
    expect(erroresCompraStock([celular("—"), celular("—")])).toEqual([]);
  });

  it("variante obligatoria y repuesto/otro con destino", () => {
    expect(erroresCompraStock([celular("3", 1, "")])).toHaveLength(1);
    expect(
      erroresCompraStock([
        { tipo: "repuesto", detalle: "Pantalla", cantidad: 2, costoUsd: 10 },
        { tipo: "otro", detalle: "Funda", cantidad: 1, costoUsd: 2, otroId: "o1" },
      ]),
    ).toHaveLength(1);
  });

  it("cantidad entera positiva", () => {
    expect(
      erroresCompraStock([
        { tipo: "repuesto", detalle: "Pantalla", cantidad: 0, costoUsd: 10, repuestoId: "r1" },
      ]),
    ).toHaveLength(1);
  });
});
