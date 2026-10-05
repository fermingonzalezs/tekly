import { describe, expect, it } from "vitest";
import {
  conteoMovimientos,
  conteoRecuentos,
  movimientosPorDia,
  movimientosPorTipo,
  recuentosPorMes,
  unidadesAjustadasPorTipo,
} from "@/lib/recuentos";
import type { MovimientoItem, MovimientoTipo, Recuento } from "@/lib/types";

function recuento(
  partial: Partial<Recuento> & Pick<Recuento, "fechaISO" | "estado">,
): Recuento {
  return {
    id: partial.id ?? partial.fechaISO,
    tipo: partial.tipo ?? "equipos",
    fecha: partial.fecha ?? partial.fechaISO,
    hora: "10:00",
    responsable: "Ana",
    lineas: partial.lineas ?? [],
    revisadoPor: partial.revisadoPor,
    ...partial,
  };
}

function movimiento(
  tipo: MovimientoTipo,
  fechaISO: string,
  parcial: Partial<MovimientoItem> = {},
): MovimientoItem {
  return {
    fecha: fechaISO,
    fechaISO,
    hora: "09:00",
    detalle: "detalle",
    usuario: "Ana",
    tipo,
    itemTipo: "equipo",
    itemNombre: "iPhone",
    ...parcial,
  };
}

describe("recuentosPorMes", () => {
  it("agrupa por mes y separa revisados/pendientes", () => {
    const r = recuentosPorMes([
      recuento({ fechaISO: "2026-09-02", estado: "pendiente" }),
      recuento({ fechaISO: "2026-09-20", estado: "revisado" }),
      recuento({ fechaISO: "2026-10-01", estado: "pendiente" }),
    ]);
    expect(r).toEqual([
      { label: "sep 2026", revisados: 1, pendientes: 1 },
      { label: "oct 2026", revisados: 0, pendientes: 1 },
    ]);
  });

  it("ordena de más viejo a más nuevo y recorta a los últimos N meses", () => {
    const r = recuentosPorMes(
      [
        recuento({ fechaISO: "2026-01-01", estado: "revisado" }),
        recuento({ fechaISO: "2026-02-01", estado: "revisado" }),
        recuento({ fechaISO: "2026-03-01", estado: "revisado" }),
      ],
      2,
    );
    expect(r.map((p) => p.label)).toEqual(["feb 2026", "mar 2026"]);
  });

  it("lista vacía devuelve lista vacía", () => {
    expect(recuentosPorMes([])).toEqual([]);
  });
});

describe("conteoRecuentos", () => {
  it("cuenta total, pendientes, revisados y con diferencias", () => {
    const r = conteoRecuentos([
      recuento({
        fechaISO: "2026-09-01",
        estado: "pendiente",
        lineas: [
          { itemId: "a", detalle: "x", eraExtraviado: true, encontrado: false, resolucion: "pendiente" },
        ],
      }),
      recuento({ fechaISO: "2026-09-02", estado: "revisado" }),
    ]);
    expect(r).toEqual({ total: 2, pendientes: 1, revisados: 1, conDiferencias: 1 });
  });
});

describe("unidadesAjustadasPorTipo", () => {
  it("suma restaurados de equipos y ajustes de repuestos/otros", () => {
    const r = unidadesAjustadasPorTipo([
      recuento({
        fechaISO: "2026-09-01",
        estado: "revisado",
        tipo: "equipos",
        lineas: [
          { itemId: "e1", detalle: "iPhone", eraExtraviado: true, encontrado: true, resolucion: "restaurado" },
          { itemId: "e2", detalle: "iPad", eraExtraviado: false, encontrado: false, resolucion: "descartado" },
        ],
      }),
      recuento({
        fechaISO: "2026-09-01",
        estado: "revisado",
        tipo: "repuestos",
        lineas: [
          { itemId: "r1", detalle: "Pantalla", cantidadSistema: 10, cantidadContada: 7, resolucion: "ajustado" },
          { itemId: "r2", detalle: "Batería", cantidadSistema: 5, cantidadContada: 5, resolucion: "descartado" },
        ],
      }),
    ]);
    expect(r).toEqual([
      { label: "Equipos", value: 1 },
      { label: "Repuestos", value: 3 },
      { label: "Otros", value: 0 },
    ]);
  });

  it("==resolucion pendiente== no cuenta", () => {
    const r = unidadesAjustadasPorTipo([
      recuento({
        fechaISO: "2026-09-01",
        estado: "pendiente",
        tipo: "repuestos",
        lineas: [
          { itemId: "r1", detalle: "Pantalla", cantidadSistema: 10, cantidadContada: 7, resolucion: "pendiente" },
        ],
      }),
    ]);
    expect(r.find((x) => x.label === "Repuestos")?.value).toBe(0);
  });
});

describe("movimientosPorDia", () => {
  it("agrupa por día, ordena y etiqueta dd/mm", () => {
    const r = movimientosPorDia([
      movimiento("ingreso", "2026-09-02T10:00:00"),
      movimiento("ingreso", "2026-09-02T12:00:00"),
      movimiento("egreso", "2026-09-01T09:00:00"),
    ]);
    expect(r).toEqual([
      { label: "01/09", value: 1 },
      { label: "02/09", value: 2 },
    ]);
  });

  it("recorta a los últimos N días", () => {
    const r = movimientosPorDia(
      [
        movimiento("ingreso", "2026-09-01T10:00:00"),
        movimiento("ingreso", "2026-09-02T10:00:00"),
        movimiento("ingreso", "2026-09-03T10:00:00"),
      ],
      2,
    );
    expect(r.map((p) => p.label)).toEqual(["02/09", "03/09"]);
  });
});

describe("conteoMovimientos", () => {
  it("cuenta total, ingresos, egresos y ajustes (ajuste + recuento)", () => {
    const r = conteoMovimientos([
      movimiento("ingreso", "2026-09-01T10:00:00"),
      movimiento("ingreso", "2026-09-01T11:00:00"),
      movimiento("egreso", "2026-09-01T12:00:00"),
      movimiento("ajuste", "2026-09-01T13:00:00"),
      movimiento("recuento", "2026-09-01T14:00:00"),
      movimiento("baja", "2026-09-01T15:00:00"),
    ]);
    expect(r).toEqual({ total: 6, ingresos: 2, egresos: 1, ajustes: 2 });
  });
});

describe("movimientosPorTipo", () => {
  it("usa el orden estable y omite los tipos sin movimientos", () => {
    const r = movimientosPorTipo([
      movimiento("ajuste", "2026-09-01T10:00:00"),
      movimiento("ingreso", "2026-09-01T11:00:00"),
      movimiento("ingreso", "2026-09-01T12:00:00"),
    ]);
    expect(r).toEqual([
      { label: "Ingreso", value: 2 },
      { label: "Ajuste", value: 1 },
    ]);
  });
});
