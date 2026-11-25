import { describe, expect, it } from "vitest";
import {
  cambioSena,
  descripcionPedido,
  senaEnCaja,
  errorPedido,
  itemPedidoVacio,
  limpiarItems,
  normalizarItems,
  saldoPedido,
  subtotalItem,
  totalPedido,
} from "./pedidos";

const item = (detalle: string, cantidad = 1, precioUsd = 100) => ({
  detalle,
  cantidad,
  precioUsd,
});

describe("totalPedido / subtotalItem", () => {
  it("suma precio × cantidad de cada fila", () => {
    expect(totalPedido([item("Funda", 2, 10), item("Cable", 3, 5.5)])).toBe(36.5);
    expect(subtotalItem(item("Funda", 2, 10))).toBe(20);
  });

  it("redondea a centavos sin arrastres de coma flotante", () => {
    expect(totalPedido([item("A", 1, 0.1), item("B", 1, 0.2)])).toBe(0.3);
  });

  it("una fila inválida suma 0 (no rompe el resumen)", () => {
    expect(subtotalItem({ detalle: "X", cantidad: "", precioUsd: "" })).toBe(0);
    expect(subtotalItem(item("X", 0, 10))).toBe(0);
    expect(subtotalItem(item("X", 1, -5))).toBe(0);
  });
});

describe("saldoPedido", () => {
  const items = [item("iPhone", 1, 850)];

  it("sin seña, el saldo es el total", () => {
    expect(saldoPedido(items, 0)).toBe(850);
  });
  it("con seña parcial, descuenta", () => {
    expect(saldoPedido(items, 200)).toBe(650);
  });
  it("seña = total → saldo 0", () => {
    expect(saldoPedido(items, 850)).toBe(0);
  });
  it("nunca negativo (los pedidos viejos no tienen seña cargada)", () => {
    expect(saldoPedido(items, 900)).toBe(0);
    expect(saldoPedido(items, Number.NaN)).toBe(850);
  });
});

describe("limpiarItems / normalizarItems", () => {
  it("descarta filas totalmente vacías", () => {
    expect(limpiarItems([itemPedidoVacio(), item("Funda", 1, 10)])).toHaveLength(1);
    expect(limpiarItems([itemPedidoVacio()])).toHaveLength(0);
  });

  it("una fila con detalle y sin precio se conserva (y después falla)", () => {
    const filas = limpiarItems([{ detalle: "Funda", cantidad: "1", precioUsd: "" }]);
    expect(filas).toHaveLength(1);
    expect(errorPedido({ items: filas, senaUsd: 0 })).toBe("Falta el precio del producto 1.");
  });

  it("normaliza cantidad a entero y precio a centavos", () => {
    const [fila] = normalizarItems([{ detalle: "  Funda  ", cantidad: "2", precioUsd: "10.456" }]);
    expect(fila).toEqual({ detalle: "Funda", cantidad: 2, precioUsd: 10.46 });
  });
});

describe("errorPedido", () => {
  it("exige al menos un producto", () => {
    expect(errorPedido({ items: [], senaUsd: 0 })).toBe("Agregá al menos un producto.");
  });

  it("exige el detalle de cada producto", () => {
    expect(errorPedido({ items: [item("A"), item("  ")], senaUsd: 0 })).toBe(
      "Falta el detalle del producto 2.",
    );
  });

  it("exige cantidad entera ≥ 1", () => {
    expect(errorPedido({ items: [item("A", 0)], senaUsd: 0 })).toContain("La cantidad del producto 1");
    expect(errorPedido({ items: [item("A", 1.5)], senaUsd: 0 })).toContain(
      "La cantidad del producto 1",
    );
    expect(errorPedido({ items: [{ detalle: "A", cantidad: "", precioUsd: 10 }], senaUsd: 0 })).toContain(
      "La cantidad del producto 1",
    );
  });

  it("rechaza precio negativo, NaN o vacío", () => {
    expect(errorPedido({ items: [item("A", 1, -1)], senaUsd: 0 })).toBe("Falta el precio del producto 1.");
    expect(errorPedido({ items: [item("A", 1, Number.NaN)], senaUsd: 0 })).toBe(
      "Falta el precio del producto 1.",
    );
    expect(errorPedido({ items: [item("A", 1, 0)], senaUsd: 0 })).toBeNull();
  });

  it("la seña no puede superar el total", () => {
    expect(errorPedido({ items: [item("A", 1, 100)], senaUsd: 101 })).toBe(
      "La seña no puede superar el total.",
    );
    expect(errorPedido({ items: [item("A", 1, 100)], senaUsd: 100 })).toBeNull();
  });

  it("rechaza una seña negativa o vacía", () => {
    expect(errorPedido({ items: [item("A")], senaUsd: -1 })).toBe("El monto de la seña no es válido.");
    expect(errorPedido({ items: [item("A")], senaUsd: Number.NaN })).toBe(
      "El monto de la seña no es válido.",
    );
  });

  it("un pedido válido devuelve null", () => {
    expect(errorPedido({ items: [item("A", 2, 50), item("B", 1, 20)], senaUsd: 30 })).toBeNull();
  });
});

describe("descripcionPedido", () => {
  it("1 ítem → su detalle", () => {
    expect(descripcionPedido([item("iPhone 15 Pro 256 GB")])).toBe("iPhone 15 Pro 256 GB");
  });
  it("1 ítem con cantidad > 1 → N× detalle", () => {
    expect(descripcionPedido([item("Funda MagSafe", 2)])).toBe("2× Funda MagSafe");
  });
  it("2 ítems → primero + 1 más", () => {
    expect(descripcionPedido([item("iPhone", 1), item("Funda", 1)])).toBe("iPhone + 1 más");
  });
  it("3+ ítems → primero + N más", () => {
    expect(descripcionPedido([item("iPhone", 1), item("Funda", 1), item("Cable", 1)])).toBe(
      "iPhone + 2 más",
    );
  });
  it("sin ítems → vacío", () => {
    expect(descripcionPedido([])).toBe("");
  });
});

describe("senaEnCaja", () => {
  it("caja USD: el monto es la seña en USD", () => {
    expect(senaEnCaja("usd", 100.456, 1400)).toEqual({ monto: 100.46, senaUsd: 100.46 });
  });
  it("caja ARS: monto en pesos redondeado y USD por la cotización", () => {
    expect(senaEnCaja("ars", 140000.4, 1400)).toEqual({ monto: 140000, senaUsd: 100 });
  });
  it("monto o cotización inválidos → null", () => {
    expect(senaEnCaja("usd", 0, 1400)).toBeNull();
    expect(senaEnCaja("ars", 1000, 0)).toBeNull();
    expect(senaEnCaja("ars", Number.NaN, 1400)).toBeNull();
  });
});

describe("cambioSena", () => {
  const ant = { cajaId: "a", monto: 100, conciliado: false };
  it("sin seña antes ni ahora → igual", () => {
    expect(cambioSena(null, null)).toBe("igual");
  });
  it("misma caja y monto → igual", () => {
    expect(cambioSena(ant, { cajaId: "a", monto: 100 })).toBe("igual");
    expect(cambioSena({ ...ant, conciliado: true }, { cajaId: "a", monto: 100 })).toBe("igual");
  });
  it("cambia monto, caja o se quita → reemplazar", () => {
    expect(cambioSena(ant, { cajaId: "a", monto: 120 })).toBe("reemplazar");
    expect(cambioSena(ant, { cajaId: "b", monto: 100 })).toBe("reemplazar");
    expect(cambioSena(ant, null)).toBe("reemplazar");
    expect(cambioSena(null, { cajaId: "a", monto: 100 })).toBe("reemplazar");
  });
  it("cambia pero ya estaba conciliada → bloqueado", () => {
    expect(cambioSena({ ...ant, conciliado: true }, null)).toBe("bloqueado");
  });
});
