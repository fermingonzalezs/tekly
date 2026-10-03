import { describe, expect, it } from "vitest";
import { NAV } from "@/lib/nav";
import {
  QUICK_ACTIONS,
  defaultTurnoSlot,
  filterNavItems,
  filterQuickActions,
  quickActionsForRole,
} from "@/lib/command-palette";

describe("filterQuickActions", () => {
  it("query vacía devuelve todas", () => {
    expect(filterQuickActions(QUICK_ACTIONS, "")).toHaveLength(
      QUICK_ACTIONS.length,
    );
    expect(filterQuickActions(QUICK_ACTIONS, "   ")).toHaveLength(
      QUICK_ACTIONS.length,
    );
  });

  it("matchea por label", () => {
    const out = filterQuickActions(QUICK_ACTIONS, "venta");
    expect(out.map((a) => a.id)).toEqual(["nueva-venta"]);
  });

  it("matchea por keywords", () => {
    const out = filterQuickActions(QUICK_ACTIONS, "fiado");
    expect(out.map((a) => a.id)).toEqual(["registrar-pago"]);
  });

  it("insensible a mayúsculas y tildes", () => {
    // "reparacion" sin tilde tiene que matchear la keyword "reparación".
    expect(filterQuickActions(QUICK_ACTIONS, "REPARACION").map((a) => a.id)).toEqual(
      ["nuevo-ticket"],
    );
    // "AGENDA" en mayúscula matchea la keyword de "Agendar turno".
    expect(filterQuickActions(QUICK_ACTIONS, "AGENDA").map((a) => a.id)).toEqual(
      ["agendar-turno"],
    );
  });

  it("sin resultados para query que no matchea nada", () => {
    expect(filterQuickActions(QUICK_ACTIONS, "xyz123")).toEqual([]);
  });
});

describe("filterNavItems", () => {
  it("query vacía devuelve todas", () => {
    expect(filterNavItems(NAV, "")).toHaveLength(NAV.length);
    expect(filterNavItems(NAV, "   ")).toHaveLength(NAV.length);
  });

  it("matchea por label, por prefijo (includes, no exacto)", () => {
    expect(filterNavItems(NAV, "ventas").map((i) => i.href)).toEqual([
      "/ventas",
    ]);
    expect(filterNavItems(NAV, "cuentas").map((i) => i.href)).toEqual([
      "/cuentas-corrientes",
    ]);
  });

  it("insensible a mayúsculas y tildes", () => {
    expect(filterNavItems(NAV, "ANALITICAS").map((i) => i.href)).toEqual([
      "/analiticas",
    ]);
    expect(filterNavItems(NAV, "reparacion").map((i) => i.href)).toEqual([
      "/reparaciones",
    ]);
  });

  it("sin resultados para query que no matchea nada", () => {
    expect(filterNavItems(NAV, "xyz123")).toEqual([]);
  });
});

describe("quickActionsForRole", () => {
  it("vendedor no ve las acciones restringidas (cajas, compras, cuentas corrientes)", () => {
    const ids = quickActionsForRole("vendedor").map((a) => a.id);
    expect(ids).not.toContain("nuevo-movimiento-caja");
    expect(ids).not.toContain("nueva-compra");
    expect(ids).not.toContain("registrar-pago");
    expect(ids).toHaveLength(4);
  });

  it("admin y técnico ven las 7", () => {
    expect(quickActionsForRole("admin")).toHaveLength(7);
    expect(quickActionsForRole("tecnico")).toHaveLength(7);
  });
});

describe("defaultTurnoSlot", () => {
  const at = (h: number, m = 0) => new Date(2026, 8, 14, h, m);

  it("antes de las 9 arranca hoy a primera hora", () => {
    expect(defaultTurnoSlot(at(8, 15))).toEqual({
      dayOffset: 0,
      hora: "09:00",
    });
  });

  it("en medio del rango redondea hacia arriba a los 30 min", () => {
    expect(defaultTurnoSlot(at(10, 7))).toEqual({ dayOffset: 0, hora: "10:30" });
    expect(defaultTurnoSlot(at(10, 30))).toEqual({ dayOffset: 0, hora: "10:30" });
    expect(defaultTurnoSlot(at(10, 31))).toEqual({ dayOffset: 0, hora: "11:00" });
  });

  it("a las 19:45 el redondeo queda en 20:00, sin pasarse", () => {
    expect(defaultTurnoSlot(at(19, 45))).toEqual({ dayOffset: 0, hora: "20:00" });
    expect(defaultTurnoSlot(at(19, 59))).toEqual({ dayOffset: 0, hora: "20:00" });
  });

  it("a las 20:00 en adelante pasa a mañana a primera hora", () => {
    expect(defaultTurnoSlot(at(20, 0))).toEqual({ dayOffset: 1, hora: "09:00" });
    expect(defaultTurnoSlot(at(23, 30))).toEqual({ dayOffset: 1, hora: "09:00" });
  });
});
