import { describe, expect, it } from "vitest";
import { accionesMiembro, estadoMiembro, HISTORIAL_USUARIO, resumenHistorial } from "./miembros";

const base = { activo: true, pendiente: false, tieneHistorial: false, esUnoMismo: false };

describe("estadoMiembro", () => {
  it("inactivo gana a pendiente", () => {
    expect(estadoMiembro({ activo: false, pendiente: true })).toBe("inactivo");
  });
  it("activo sin aceptar la invitación = pendiente", () => {
    expect(estadoMiembro({ activo: true, pendiente: true })).toBe("pendiente");
    expect(estadoMiembro({ activo: true, pendiente: false })).toBe("activo");
  });
});

describe("accionesMiembro", () => {
  it("uno mismo no tiene acciones", () => {
    expect(accionesMiembro({ ...base, esUnoMismo: true, pendiente: true })).toEqual({
      reenviarInvitacion: false,
      reactivar: false,
      eliminar: false,
      desactivar: false,
    });
  });

  it("activo sin historial → eliminar, no desactivar", () => {
    const a = accionesMiembro(base);
    expect(a.eliminar).toBe(true);
    expect(a.desactivar).toBe(false);
    expect(a.reactivar).toBe(false);
  });

  it("activo con historial → desactivar, no eliminar", () => {
    const a = accionesMiembro({ ...base, tieneHistorial: true });
    expect(a.desactivar).toBe(true);
    expect(a.eliminar).toBe(false);
  });

  it("mientras no se sabe el historial no ofrece eliminar ni desactivar", () => {
    const a = accionesMiembro({ ...base, tieneHistorial: undefined });
    expect(a.eliminar).toBe(false);
    expect(a.desactivar).toBe(false);
  });

  it("invitación pendiente → reenviar", () => {
    expect(accionesMiembro({ ...base, pendiente: true }).reenviarInvitacion).toBe(true);
  });

  it("inactivo → reactivar; eliminar solo sin historial; nunca reenviar", () => {
    const sin = accionesMiembro({ ...base, activo: false, pendiente: true });
    expect(sin).toEqual({ reenviarInvitacion: false, reactivar: true, eliminar: true, desactivar: false });
    const con = accionesMiembro({ ...base, activo: false, tieneHistorial: true });
    expect(con).toEqual({ reenviarInvitacion: false, reactivar: true, eliminar: false, desactivar: false });
  });
});

describe("resumenHistorial", () => {
  it("vacío sin filas", () => {
    expect(resumenHistorial([{ singular: "venta", plural: "ventas", cantidad: 0 }])).toBe("");
  });
  it("singular/plural y conector", () => {
    expect(
      resumenHistorial([
        { singular: "venta", plural: "ventas", cantidad: 3 },
        { singular: "ticket asignado", plural: "tickets asignados", cantidad: 1 },
        { singular: "recuento", plural: "recuentos", cantidad: 0 },
        { singular: "conciliación", plural: "conciliaciones", cantidad: 2 },
      ]),
    ).toBe("3 ventas, 1 ticket asignado y 2 conciliaciones");
  });
});

describe("HISTORIAL_USUARIO", () => {
  it("cubre ventas y tickets (los casos más comunes)", () => {
    const pares = HISTORIAL_USUARIO.map((h) => `${h.tabla}.${h.columna}`);
    expect(pares).toContain("ventas.vendedor_id");
    expect(pares).toContain("tickets.tecnico_id");
  });
});
