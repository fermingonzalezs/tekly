import { describe, expect, it } from "vitest";
import { crearSeedDemo, fechaISOLocal, type DemoState } from "@/lib/demo/seed";
import { consultarVentas } from "@/lib/demo/ventas-query";
import { rangoDe, type FiltrosVentas } from "@/lib/ventas-filtros";
import type { Rango } from "@/lib/date-presets";
import type { Equipo, Venta, VentaItem } from "@/lib/types";

const HOY = new Date(2026, 9, 4, 12, 0, 0); // 4 oct 2026

function item(overrides: Partial<VentaItem> = {}): VentaItem {
  return { detalle: "Ítem", cantidad: 1, precioUsd: 100, ...overrides };
}

function venta(
  partial: Partial<Venta> & Pick<Venta, "id" | "fechaISO">,
): Venta {
  const items = partial.items ?? [item()];
  const totalUsd =
    partial.totalUsd ??
    items.reduce((a, i) => a + i.precioUsd * i.cantidad, 0);
  return {
    fecha: partial.fechaISO,
    clienteId: "demo-cliente-1",
    cliente: partial.cliente ?? "Cliente Demo",
    vendedorId: partial.vendedorId ?? "demo-vendedor-1",
    vendedor: "Vendedor",
    modalidad: "minorista",
    pagos: [{ medio: "pesos", montoUsd: totalUsd, caja: "ars", cajaId: "demo-caja-1" }],
    margenPct: 0,
    tipo: "venta",
    ...partial,
    items,
    totalUsd,
  };
}

function equipo(id: string, imei: string): Equipo {
  return {
    id,
    modelo: "iPhone 12",
    almacenamiento: "128GB",
    color: "Azul",
    imei,
    bateria: 90,
    condicion: "A",
    costoUsd: 500,
    precioUsd: 700,
    estado: "vendido",
  };
}

function estadoCon(ventas: Venta[], equipos: Equipo[] = []): DemoState {
  return { ...crearSeedDemo(HOY), ventas, equipos };
}

function filtros(overrides: Partial<FiltrosVentas> = {}): FiltrosVentas {
  return {
    preset: "todos",
    desde: "",
    hasta: "",
    vendedor: "",
    tipo: "",
    q: "",
    vista: "ventas",
    page: 1,
    sort: "fecha",
    dir: "desc",
    ...overrides,
  };
}

function consultar(
  state: DemoState,
  f: Partial<FiltrosVentas> = {},
  rangoAnterior: Rango | null = null,
  openId: string | null = null,
) {
  const completos = filtros(f);
  return consultarVentas(state, completos, rangoDe(completos, HOY), rangoAnterior, openId);
}

describe("consultarVentas · rango", () => {
  const state = estadoCon([
    venta({ id: "V-1", fechaISO: "2026-08-15" }),
    venta({ id: "V-2", fechaISO: "2026-09-20" }),
    venta({ id: "V-3", fechaISO: "2026-10-02" }),
  ]);

  it("preset mes (1..hoy) solo incluye el mes en curso", () => {
    const out = consultar(state, { preset: "mes" });
    expect(out.ventas.map((v) => v.id)).toEqual(["V-3"]);
    expect(out.totalVentas).toBe(1);
  });

  it("preset mes_anterior incluye septiembre completo", () => {
    const out = consultar(state, { preset: "mes_anterior" });
    expect(out.ventas.map((v) => v.id)).toEqual(["V-2"]);
  });

  it("preset todos incluye todo", () => {
    expect(consultar(state).totalVentas).toBe(3);
  });
});

describe("consultarVentas · búsqueda q", () => {
  const state = estadoCon(
    [
      venta({ id: "V-1001", fechaISO: "2026-10-01", cliente: "Lucía Fernández" }),
      venta({ id: "V-1002", fechaISO: "2026-10-02", cliente: "Martín Gómez" }),
      venta({
        id: "V-1003",
        fechaISO: "2026-10-03",
        cliente: "Otro",
        items: [item({ detalle: "Cambio de pantalla", equipoId: "demo-equipo-9" })],
      }),
    ],
    [equipo("demo-equipo-9", "123456789012345")],
  );

  it("por número exacto (con y sin prefijo V-)", () => {
    expect(consultar(state, { q: "1002" }).ventas.map((v) => v.id)).toEqual(["V-1002"]);
    expect(consultar(state, { q: "V-1002" }).ventas.map((v) => v.id)).toEqual(["V-1002"]);
  });

  it("por cliente case-insensitive", () => {
    expect(consultar(state, { q: "lucía" }).ventas.map((v) => v.id)).toEqual(["V-1001"]);
  });

  it("por detalle de ítem", () => {
    expect(consultar(state, { q: "pantalla" }).ventas.map((v) => v.id)).toEqual(["V-1003"]);
  });

  it("por IMEI de equipo", () => {
    expect(consultar(state, { q: "9012" }).ventas.map((v) => v.id)).toEqual(["V-1003"]);
  });

  it("sin match devuelve vacío", () => {
    expect(consultar(state, { q: "zzz" }).totalVentas).toBe(0);
  });
});

describe("consultarVentas · tipo (rubro)", () => {
  const state = estadoCon([
    venta({
      id: "V-1",
      fechaISO: "2026-10-01",
      items: [item({ categoria: "servicio", detalle: "Batería" })],
    }),
    venta({
      id: "V-2",
      fechaISO: "2026-10-02",
      items: [item({ categoria: "equipo", detalle: "iPhone", equipoId: "e1" })],
    }),
  ]);

  it("filtra ventas que tienen al menos un ítem del rubro", () => {
    expect(consultar(state, { tipo: "servicio" }).ventas.map((v) => v.id)).toEqual(["V-1"]);
    expect(consultar(state, { tipo: "equipo" }).ventas.map((v) => v.id)).toEqual(["V-2"]);
  });

  it("en la vista ítems filtra el ítem, no la venta entera", () => {
    const mixta = estadoCon([
      venta({
        id: "V-9",
        fechaISO: "2026-10-03",
        items: [
          item({ categoria: "equipo", detalle: "iPhone", equipoId: "e1" }),
          item({ categoria: "servicio", detalle: "Batería" }),
        ],
      }),
    ]);
    const out = consultar(mixta, { tipo: "servicio", vista: "items" });
    expect(out.totalItems).toBe(1);
    expect(out.items[0].item.detalle).toBe("Batería");
  });
});

describe("consultarVentas · orden", () => {
  const state = estadoCon([
    venta({ id: "V-1", fechaISO: "2026-10-01", totalUsd: 300 }),
    venta({ id: "V-2", fechaISO: "2026-10-02", totalUsd: 100 }),
    venta({ id: "V-3", fechaISO: "2026-10-03", totalUsd: 200 }),
  ]);

  it("por total asc/desc", () => {
    expect(consultar(state, { sort: "total_usd", dir: "asc" }).ventas.map((v) => v.totalUsd)).toEqual([100, 200, 300]);
    expect(consultar(state, { sort: "total_usd", dir: "desc" }).ventas.map((v) => v.totalUsd)).toEqual([300, 200, 100]);
  });

  it("por fecha asc/desc", () => {
    expect(consultar(state, { sort: "fecha", dir: "asc" }).ventas.map((v) => v.id)).toEqual(["V-1", "V-2", "V-3"]);
    expect(consultar(state, { sort: "fecha", dir: "desc" }).ventas.map((v) => v.id)).toEqual(["V-3", "V-2", "V-1"]);
  });
});

describe("consultarVentas · paginación y resumen global", () => {
  const muchas = Array.from({ length: 60 }, (_, i) =>
    venta({
      id: `V-${2000 + i}`,
      fechaISO: "2026-10-01",
      totalUsd: 10,
    }),
  );
  const state = estadoCon(muchas);

  it("pagina de a 50", () => {
    const p1 = consultar(state, { page: 1 });
    const p2 = consultar(state, { page: 2 });
    expect(p1.ventas).toHaveLength(50);
    expect(p1.totalVentas).toBe(60);
    expect(p2.ventas).toHaveLength(10);
  });

  it("el resumen usa todas las ventas filtradas, no la página", () => {
    const out = consultar(state, { page: 1 });
    expect(out.resumen.operaciones).toBe(60);
    expect(out.resumen.facturado).toBe(600);
  });
});

describe("consultarVentas · ventaAbierta e ítems vendidos", () => {
  const muchas = Array.from({ length: 55 }, (_, i) =>
    venta({ id: `V-${3000 + i}`, fechaISO: "2026-10-01", totalUsd: 10 }),
  );
  const state = estadoCon(muchas);

  it("trae la venta del deep link aunque no esté en la página", () => {
    const fuera = "V-3000"; // page 1 (desc por fecha+numero) incluye las últimas
    const enPagina = muchas[54].id;
    expect(consultar(state, { page: 1 }, null, fuera).ventaAbierta?.id).toBe(fuera);
    expect(consultar(state, { page: 1 }, null, enPagina).ventaAbierta).toBeNull();
    expect(consultar(state, { page: 1 }, null, "V-99999").ventaAbierta).toBeNull();
  });

  it("arma una fila por ítem con su serial", () => {
    const s = estadoCon(
      [
        venta({
          id: "V-1",
          fechaISO: "2026-10-01",
          items: [
            item({ detalle: "iPhone", equipoId: "eq1" }),
            item({ detalle: "Funda", categoria: "otro" }),
          ],
        }),
      ],
      [equipo("eq1", "999888777666555")],
    );
    const out = consultar(s, { vista: "items" });
    expect(out.totalItems).toBe(2);
    expect(out.items[0].serial).toBe("999888777666555");
    expect(out.items[1].serial).toBeUndefined();
  });
});

describe("consultarVentas · resumenAnterior", () => {
  const state = estadoCon([
    venta({ id: "V-1", fechaISO: "2026-09-15", totalUsd: 100 }),
    venta({ id: "V-2", fechaISO: "2026-10-02", totalUsd: 250 }),
  ]);

  it("compara contra el rango anterior con los mismos filtros", () => {
    const out = consultar(state, { preset: "mes" }, { desde: "2026-09-01", hasta: "2026-09-30" });
    expect(out.resumen.facturado).toBe(250);
    expect(out.resumenAnterior?.facturado).toBe(100);
  });

  it("sin rango anterior devuelve null", () => {
    expect(consultar(state).resumenAnterior).toBeNull();
  });
});

describe("consultarVentas · determinismo con el seed", () => {
  it("no muta el seed y respeta el rango por fecha", () => {
    const state = crearSeedDemo(HOY);
    const antes = JSON.stringify(state);
    const out = consultar(state, { preset: "mes" });
    expect(JSON.stringify(state)).toBe(antes);
    for (const v of out.ventas) {
      expect(v.fechaISO >= `${fechaISOLocal(HOY).slice(0, 7)}-01`).toBe(true);
      expect(v.fechaISO <= fechaISOLocal(HOY)).toBe(true);
    }
    expect(out.graficos.porDia.length).toBeGreaterThan(0);
  });
});
