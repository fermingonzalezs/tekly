import { describe, expect, it } from "vitest";
import { armarPatrimonio } from "@/lib/patrimonio";
import type {
  Caja,
  Celular,
  ClienteOpcion,
  Compra,
  MedioPago,
  MovimientoCaja,
  MovimientoCC,
  OtroItem,
  Ticket,
} from "@/lib/types";

function caja(
  id: string,
  moneda: "usd" | "ars",
  medioPago: MedioPago = "pesos",
): Caja {
  return {
    id,
    nombre: `Caja ${id}`,
    moneda,
    activa: true,
    descripcion: "",
    creadaEl: "mar 2023",
    medioPago,
  };
}

function movCaja(
  cajaId: string,
  monto: number,
  tipo: "ingreso" | "egreso" = "ingreso",
  cotizacion: number | null = null,
): MovimientoCaja {
  return {
    id: `${cajaId}-${monto}-${tipo}`,
    fecha: "01 ene",
    fechaISO: "2026-01-01",
    hora: "10:00",
    concepto: "test",
    medioPago: "pesos",
    tipo,
    categoria: null,
    cajaId,
    monto,
    cotizacion,
    ticketId: null,
    usuario: "test",
    conciliacionId: null,
  };
}

function movCC(
  clienteId: string,
  tipo: "cargo" | "pago",
  montoUsd: number,
): MovimientoCC {
  return {
    id: `${clienteId}-${tipo}`,
    clienteId,
    fecha: "01 ene",
    fechaISO: "2026-01-01",
    hora: "10:00",
    concepto: "test",
    tipo,
    montoUsd,
    ticketId: null,
    usuario: "test",
  };
}

function cliente(id: string, nombre: string): ClienteOpcion {
  return { id, nombre, telefono: "", email: "" };
}

function celular(id: string, estado: Celular["estado"], costoUsd = 100, precioUsd = 150): Celular {
  return {
    id,
    modelo: `iPhone ${id}`,
    almacenamiento: "128GB",
    color: "Negro",
    imei: id,
    bateria: 100,
    condicion: "A",
    costoUsd,
    precioUsd,
    estado,
  };
}

function otro(id: string, cantidad: number, costoUsd: number): OtroItem {
  return {
    id,
    nombre: `Otro ${id}`,
    categoria: "ipad",
    precioUsd: 20,
    serializado: false,
    cantidad,
    costoUsd,
  };
}

function compra(
  id: string,
  estado: Compra["estado"],
  totalUsd: number,
  cajaId: string | null = "caja-1",
): Compra {
  return {
    cajaId: cajaId ?? undefined,
    id,
    fecha: "01 ene",
    fechaISO: "2026-01-01",
    origen: "proveedor",
    proveedor: "Prov",
    items: [],
    totalUsd,
    medioPago: "pesos",
    estado,
  };
}

function ticket(id: number, estado: Ticket["estado"], presupuestoUsd: number): Ticket {
  return {
    id,
    clienteId: "c1",
    cliente: "Cliente",
    equipo: "iPhone 13",
    imei: "",
    falla: "x",
    tecnicoId: null,
    tecnico: null,
    estado,
    ingreso: "01 ene",
    fechaISO: "2026-01-01",
    presupuestoUsd,
    servicios: [],
  };
}

const base = {
  cotizacion: 1000,
  cajas: [] as Caja[],
  movimientos: [] as MovimientoCaja[],
  movimientosCC: [] as MovimientoCC[],
  clientes: [] as ClienteOpcion[],
  celulares: [] as Celular[],
  notebooks: [],
  repuestos: [],
  otros: [] as OtroItem[],
  compras: [] as Compra[],
  tickets: [] as Ticket[],
};

describe("armarPatrimonio", () => {
  it("convierte caja USD tal cual y caja ARS con la cotización de hoy", () => {
    const p = armarPatrimonio({
      ...base,
      cotizacion: 1000,
      cajas: [caja("usd", "usd"), caja("ars", "ars")],
      movimientos: [movCaja("usd", 500), movCaja("ars", 1_000_000)],
    });
    expect(p.activo.disponibilidades.total).toBe(1500);
    const usd = p.activo.disponibilidades.cajas.find((c) => c.id === "usd")!;
    expect(usd.enUsd).toBe(500);
    const ars = p.activo.disponibilidades.cajas.find((c) => c.id === "ars")!;
    expect(ars.saldo).toBe(1_000_000);
    expect(ars.enUsd).toBe(1000);
  });

  it("una caja de medio canje (dato viejo, plan 020) cuenta como cualquier otra", () => {
    const p = armarPatrimonio({
      ...base,
      cajas: [caja("usd", "usd"), caja("canje", "usd", "canje")],
      movimientos: [movCaja("usd", 300), movCaja("canje", 900)],
    });
    expect(p.activo.disponibilidades.total).toBe(1200);
    expect(p.activo.disponibilidades.cajas.map((c) => c.id).sort()).toEqual([
      "canje",
      "usd",
    ]);
  });

  it("pone las deudas en créditos y los saldos a favor en el pasivo (un cliente en uno solo)", () => {
    const p = armarPatrimonio({
      ...base,
      clientes: [cliente("c1", "Deudor"), cliente("c2", "A favor")],
      movimientosCC: [
        movCC("c1", "cargo", 500),
        movCC("c1", "pago", 100), // saldo 400 (debe)
        movCC("c2", "cargo", 100),
        movCC("c2", "pago", 300), // saldo -200 (a favor)
      ],
    });
    expect(p.activo.creditos.total).toBe(400);
    expect(p.activo.creditos.cantidadClientes).toBe(1);
    expect(p.activo.creditos.top[0]).toMatchObject({ clienteId: "c1", saldo: 400 });
    expect(p.pasivo.saldosAFavor.total).toBe(200);
    expect(p.pasivo.saldosAFavor.cantidadClientes).toBe(1);
    expect(p.pasivo.saldosAFavor.top[0]).toMatchObject({ clienteId: "c2", saldo: -200 });
    // c1 no aparece en el pasivo ni c2 en créditos
    expect(p.pasivo.saldosAFavor.top.some((s) => s.clienteId === "c1")).toBe(false);
    expect(p.activo.creditos.top.some((s) => s.clienteId === "c2")).toBe(false);
  });

  it("valúa el inventario excluyendo vendidos y extraviados, y separa el extraviado al memo", () => {
    const p = armarPatrimonio({
      ...base,
      celulares: [
        celular("1", "disponible", 100, 150),
        celular("2", "vendido", 999, 999),
        celular("3", "extraviado", 50, 80),
      ],
      otros: [otro("o1", 2, 100)],
    });
    expect(p.activo.inventario.total).toBe(300); // 100 + 200
    expect(p.memo.extraviadoACosto).toBe(50);
    const cel = p.activo.inventario.porCategoria.find((c) => c.key === "celulares")!;
    expect(cel.unidades).toBe(1);
    expect(p.memo.inventarioAPrecioVenta).toBe(190); // 150 (celular) + 40 (2*20 otros)
  });

  it("cuenta ítems sin costo en sinCosto sin sumarlos", () => {
    const p = armarPatrimonio({
      ...base,
      celulares: [celular("1", "disponible", 0, 100)],
      otros: [otro("o1", 3, 0)],
    });
    expect(p.activo.inventario.total).toBe(0);
    expect(p.activo.inventario.porCategoria.find((c) => c.key === "celulares")!.sinCosto).toBe(1);
    expect(p.activo.inventario.porCategoria.find((c) => c.key === "otros")!.sinCosto).toBe(3);
  });

  it("suma compras pendientes a anticipos y no las recibidas", () => {
    const p = armarPatrimonio({
      ...base,
      compras: [compra("p1", "pendiente", 500), compra("p2", "recibida", 800)],
    });
    expect(p.activo.anticipos.total).toBe(500);
    expect(p.activo.anticipos.cantidad).toBe(1);
  });

  it("una compra pendiente sin egreso de caja no es anticipo (va al memo)", () => {
    const p = armarPatrimonio({
      ...base,
      compras: [compra("p1", "pendiente", 1800), compra("p2", "pendiente", 90, null)],
    });
    expect(p.activo.anticipos.total).toBe(1800);
    expect(p.activo.anticipos.cantidad).toBe(1);
    expect(p.memo.comprasPendientesSinPago).toEqual({ total: 90, cantidad: 1 });
  });

  it("la deuda de un cliente dado de baja sigue en el balance", () => {
    const p = armarPatrimonio({
      ...base,
      clientes: [], // el cliente ya no está entre los activos
      movimientosCC: [movCC("c9", "cargo", 300)],
    });
    expect(p.activo.creditos.total).toBe(300);
    expect(p.activo.creditos.top[0]).toMatchObject({ clienteId: "c9", nombre: "Cliente dado de baja" });
  });

  it("con cotización 0/NaN no revienta: caja ARS sin convertir y marcada", () => {
    const p = armarPatrimonio({
      ...base,
      cotizacion: 0,
      cajas: [caja("usd", "usd"), caja("ars", "ars")],
      movimientos: [movCaja("usd", 100), movCaja("ars", 500_000, "ingreso", null)],
    });
    expect(p.cotizacionValida).toBe(false);
    const ars = p.activo.disponibilidades.cajas.find((c) => c.id === "ars")!;
    expect(ars.saldo).toBe(500_000);
    expect(ars.enUsd).toBeNull();
    expect(p.activo.disponibilidades.total).toBe(100); // solo la caja USD
    expect(p.memo.movimientosSinCotizacion).toBe(1);
  });

  it("patrimonio neto = activo − pasivo, y cuenta trabajos en curso en el memo", () => {
    const p = armarPatrimonio({
      ...base,
      cajas: [caja("usd", "usd")],
      movimientos: [movCaja("usd", 1000)],
      clientes: [cliente("c1", "D")],
      movimientosCC: [movCC("c1", "pago", 200)], // saldo -200 (a favor)
      tickets: [ticket(1, "listo", 300), ticket(2, "entregado", 999)],
    });
    expect(p.activo.total).toBe(1000);
    expect(p.pasivo.total).toBe(200);
    expect(p.patrimonioNeto).toBe(800);
    expect(p.memo.trabajosEnCurso).toEqual({ total: 300, cantidad: 1 });
  });
});
