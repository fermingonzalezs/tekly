import { describe, expect, it } from "vitest";
import { crearSeedDemo, fechaISOLocal } from "@/lib/demo/seed";
import {
  crearVentaDemo,
  eliminarVentaDemo,
  type CrearVentaDemoInput,
} from "@/lib/demo/operaciones";

const HOY = new Date(2026, 9, 4, 15, 30, 0);

function inputBase(overrides: Partial<CrearVentaDemoInput> = {}): CrearVentaDemoInput {
  return {
    cliente: { tipo: "nuevo", nombre: "Cliente Nuevo", telefono: "11-1234-5678" },
    vendedorId: "demo-vendedor-1",
    vendedorNombre: "Ana Pérez",
    modalidad: "minorista",
    items: [
      { detalle: "iPhone 12 128GB Azul", cantidad: 1, precioUsd: 1000, costoUsd: 700, categoria: "equipo" },
    ],
    totalUsd: 1000,
    pagos: [{ medio: "pesos", montoUsd: 1000, caja: "ars", cajaId: "demo-caja-1" }],
    margenPct: 30,
    tipo: "venta",
    dolarVenta: 1500,
    ...overrides,
  };
}

describe("crearVentaDemo", () => {
  it("numera V-<contador+1> y avanza el contador", () => {
    const state = crearSeedDemo(HOY);
    const { state: next, venta } = crearVentaDemo(state, inputBase(), HOY);
    expect(venta.id).toBe(`V-${state.contadorVentas + 1}`);
    expect(next.contadorVentas).toBe(state.contadorVentas + 1);
    expect(next.ventas).toHaveLength(state.ventas.length + 1);
    expect(next.ventas[0].id).toBe(venta.id);
  });

  it("cliente nuevo se agrega al store y queda ligado a la venta", () => {
    const state = crearSeedDemo(HOY);
    const { state: next, venta } = crearVentaDemo(state, inputBase(), HOY);
    expect(next.clientes).toHaveLength(state.clientes.length + 1);
    const nuevo = next.clientes.find((c) => c.id === venta.clienteId);
    expect(nuevo?.nombre).toBe("Cliente Nuevo");
    expect(venta.cliente).toBe("Cliente Nuevo");
  });

  it("cliente existente se resuelve sin agregar filas", () => {
    const state = crearSeedDemo(HOY);
    const existente = state.clientes[3];
    const { state: next, venta } = crearVentaDemo(
      state,
      inputBase({ cliente: { tipo: "existente", id: existente.id, nombre: "otro nombre" } }),
      HOY,
    );
    expect(next.clientes).toHaveLength(state.clientes.length);
    expect(venta.clienteId).toBe(existente.id);
    expect(venta.cliente).toBe(existente.nombre);
  });

  it("marca vendido el equipo del stock", () => {
    const state = crearSeedDemo(HOY);
    const libre = state.equipos.find((e) => e.estado === "disponible")!;
    const { state: next, venta } = crearVentaDemo(
      state,
      inputBase({
        items: [
          { detalle: "Equipo", cantidad: 1, precioUsd: 600, costoUsd: 400, equipoId: libre.id, categoria: "equipo" },
        ],
        totalUsd: 600,
        pagos: [{ medio: "dolares", montoUsd: 600, caja: "usd", cajaId: "demo-caja-3" }],
      }),
      HOY,
    );
    expect(venta.items[0].equipoId).toBe(libre.id);
    expect(next.equipos.find((e) => e.id === libre.id)?.estado).toBe("vendido");
  });

  it("descuenta stock de los repuestos usados", () => {
    const state = crearSeedDemo(HOY);
    const rep = state.repuestos[0];
    const { state: next } = crearVentaDemo(
      state,
      inputBase({
        items: [
          {
            detalle: "Cambio de pantalla",
            cantidad: 1,
            precioUsd: 180,
            costoUsd: 120,
            categoria: "servicio",
            repuestos: [{ repuestoId: rep.id, nombre: rep.nombre, cantidad: 2 }],
          },
        ],
        totalUsd: 180,
        pagos: [{ medio: "pesos", montoUsd: 180, caja: "ars", cajaId: "demo-caja-1" }],
      }),
      HOY,
    );
    expect(next.repuestos.find((r) => r.id === rep.id)?.stock).toBe(rep.stock - 2);
  });

  it("arma cotización/montoArs de los pagos ARS igual que createVenta", () => {
    const state = crearSeedDemo(HOY);
    const { venta } = crearVentaDemo(
      state,
      inputBase({
        pagos: [
          { medio: "transferencia", montoUsd: 500, caja: "ars", cajaId: "demo-caja-2", recargoPct: 10 },
        ],
        totalUsd: 500,
      }),
      HOY,
    );
    // 500 * 1.1 * 1500 = 825.000
    expect(venta.pagos[0].cotizacion).toBe(1500);
    expect(venta.pagos[0].montoArs).toBe(825000);
  });

  it("calcula el margen desde los ítems (ignora el input) y fecha desde `hoy`", () => {
    const state = crearSeedDemo(HOY);
    const { venta } = crearVentaDemo(
      state,
      inputBase({ margenPct: 999 }),
      HOY,
    );
    expect(venta.margenPct).toBeCloseTo(30, 5);
    expect(venta.fechaISO).toBe(fechaISOLocal(HOY));
    expect(state.ventas).not.toContainEqual(venta);
  });

  it("no muta el estado original", () => {
    const state = crearSeedDemo(HOY);
    const antes = JSON.parse(JSON.stringify(state));
    crearVentaDemo(state, inputBase(), HOY);
    expect(JSON.parse(JSON.stringify(state))).toEqual(antes);
  });
});

describe("eliminarVentaDemo", () => {
  it("saca la venta y restituye equipos y repuestos con los flags", () => {
    const state = crearSeedDemo(HOY);
    const venta = state.ventas[0];
    const equipoId = venta.items.find((i) => i.equipoId)?.equipoId;
    const repuestoId = venta.items.flatMap((i) => i.repuestos ?? [])[0]?.repuestoId;

    const next = eliminarVentaDemo(state, venta.id, {
      restituirEquipos: true,
      restituirRepuestos: true,
    });

    expect(next.ventas.find((v) => v.id === venta.id)).toBeUndefined();
    expect(next.ventas).toHaveLength(state.ventas.length - 1);
    if (equipoId) {
      expect(next.equipos.find((e) => e.id === equipoId)?.estado).toBe("disponible");
    }
    if (repuestoId) {
      const antes = state.repuestos.find((r) => r.id === repuestoId)!.stock;
      expect(next.repuestos.find((r) => r.id === repuestoId)?.stock).toBeGreaterThanOrEqual(antes);
    }
  });

  it("con los flags en false no toca inventario", () => {
    const state = crearSeedDemo(HOY);
    const next = eliminarVentaDemo(state, state.ventas[0].id, {
      restituirEquipos: false,
      restituirRepuestos: false,
    });
    expect(next.equipos).toEqual(state.equipos);
    expect(next.repuestos).toEqual(state.repuestos);
  });

  it("id inexistente devuelve el mismo estado", () => {
    const state = crearSeedDemo(HOY);
    expect(eliminarVentaDemo(state, "V-99999", { restituirEquipos: true, restituirRepuestos: true })).toBe(state);
  });
});
