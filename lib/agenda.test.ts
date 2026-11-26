import { describe, expect, it } from "vitest";
import {
  pedidoVencido,
  pedidosDelDia,
  agruparProximos,
  agruparSolapados,
  calcularSolapes,
  etiquetaRango,
  horaAMinutos,
  horaFin,
  kpisAgenda,
  minutosAHora,
  moverFecha,
  parseFiltrosAgenda,
  rangoDeVista,
  semanaDe,
  semanasDelMes,
  turnosSuperpuestos,
  fechaLarga,
  textoTurno,
} from "./agenda";
import type { Pedido, Turno } from "./types";

const t = (p: Partial<Turno>): Turno => ({
  id: "x",
  fecha: "2026-11-24",
  dayOffset: 0,
  hora: "10:00",
  duracionMin: 30,
  cliente: "C",
  clienteId: null,
  tipo: "cotizar",
  estado: "confirmado",
  ticketId: null,
  atiendeId: null,
  atiende: null,
  ...p,
});

describe("horas", () => {
  it("convierte ida y vuelta", () => {
    expect(horaAMinutos("10:30")).toBe(630);
    expect(minutosAHora(630)).toBe("10:30");
    expect(horaFin("10:30", 60)).toBe("11:30");
  });
});

describe("semanaDe", () => {
  it("devuelve lunes a sábado", () => {
    // 2026-11-24 es martes
    expect(semanaDe("2026-11-24")).toEqual([
      "2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28",
    ]);
  });
  it("un domingo muestra la semana siguiente", () => {
    expect(semanaDe("2026-11-29")[0]).toBe("2026-11-30");
  });
  it("cruza de mes y de año", () => {
    expect(semanaDe("2026-12-31")[0]).toBe("2026-12-28");
    expect(semanaDe("2026-12-31")[5]).toBe("2027-01-02");
  });
});

describe("rangoDeVista / moverFecha / etiquetaRango", () => {
  it("rango", () => {
    expect(rangoDeVista("semana", "2026-11-24")).toEqual({ desde: "2026-11-23", hasta: "2026-11-28" });
    expect(rangoDeVista("mes", "2026-11-24")).toEqual({ desde: "2026-11-02", hasta: "2026-12-05" });
  });
  it("las semanas del mes cubren todos los días hábiles", () => {
    const semanas = semanasDelMes("2026-11-10");
    expect(semanas.flat()).toContain("2026-11-30");
    expect(semanas.flat()).toContain("2026-11-02");
    expect(semanas.flat()).not.toContain("2026-11-01"); // domingo
  });
  it("mueve", () => {
    expect(moverFecha("semana", "2026-11-24", -1)).toBe("2026-11-17");
    expect(moverFecha("mes", "2026-01-31", 1)).toBe("2026-02-01");
    expect(moverFecha("mes", "2026-01-15", -1)).toBe("2025-12-01");
  });
  it("etiqueta", () => {
    expect(etiquetaRango("semana", "2026-11-24")).toBe("23 al 28 de noviembre");
    expect(etiquetaRango("semana", "2026-12-01")).toBe("30 de noviembre al 5 de diciembre");
    expect(etiquetaRango("mes", "2026-11-24")).toBe("Noviembre de 2026");
  });
});

describe("parseFiltrosAgenda", () => {
  it("defaults", () => {
    expect(parseFiltrosAgenda({}, "2026-11-24")).toEqual({ vista: "semana", fecha: "2026-11-24" });
  });
  it("valores válidos", () => {
    expect(parseFiltrosAgenda({ vista: "mes", fecha: "2026-02-10" }, "2026-11-24")).toEqual({
      vista: "mes",
      fecha: "2026-02-10",
    });
  });
  it("inválidos caen al default", () => {
    expect(parseFiltrosAgenda({ vista: "año", fecha: "2026-02-31" }, "2026-11-24")).toEqual({
      vista: "semana",
      fecha: "2026-11-24",
    });
  });
});

describe("solapes", () => {
  it("dos turnos que se pisan se reparten el ancho", () => {
    const r = calcularSolapes([t({ id: "a", hora: "10:00", duracionMin: 60 }), t({ id: "b", hora: "10:30" })]);
    expect(r.map((x) => [x.evento.id, x.col, x.cols])).toEqual([["a", 0, 2], ["b", 1, 2]]);
  });
  it("turnos consecutivos no se pisan", () => {
    const r = calcularSolapes([t({ id: "a", hora: "10:00" }), t({ id: "b", hora: "10:30" })]);
    expect(r.every((x) => x.cols === 1)).toBe(true);
  });
  it("agrupa solapados", () => {
    const g = agruparSolapados([
      t({ id: "a", hora: "10:00", duracionMin: 60 }),
      t({ id: "b", hora: "10:30" }),
      t({ id: "c", hora: "12:00" }),
    ]);
    expect(g.map((x) => x.map((y) => y.id))).toEqual([["a", "b"], ["c"]]);
  });
});

describe("agruparProximos", () => {
  const hoy = "2026-11-24";
  it("separa vencidos, hoy, mañana, semana y después; ignora cerrados", () => {
    const g = agruparProximos(
      [
        t({ id: "v", fecha: "2026-11-20", estado: "pendiente" }),
        t({ id: "h", fecha: hoy }),
        t({ id: "m", fecha: "2026-11-25" }),
        t({ id: "s", fecha: "2026-11-27" }),
        t({ id: "d", fecha: "2026-12-10" }),
        t({ id: "at", fecha: "2026-11-20", estado: "atendido" }),
        t({ id: "ca", fecha: hoy, estado: "cancelado" }),
      ],
      hoy,
    );
    expect(g.map((x) => [x.clave, x.items.map((y) => y.id)])).toEqual([
      ["atrasados", ["v"]],
      ["hoy", ["h"]],
      ["manana", ["m"]],
      ["semana", ["s"]],
      ["despues", ["d"]],
    ]);
  });
  it("omite grupos vacíos", () => {
    expect(agruparProximos([], hoy)).toEqual([]);
  });
  it("mezcla pedidos abiertos (primero en su día, sin hora) y saca entregados/cancelados", () => {
    const p = (id: string, fechaEntrega: string, estado: Pedido["estado"] = "pedido") =>
      ({ id, fechaEntrega, estado }) as Pedido;
    const g = agruparProximos(
      [t({ id: "h", fecha: hoy, hora: "09:00" }), t({ id: "v", fecha: "2026-11-22" })],
      hoy,
      [p("pa", "2026-11-20", "llego"), p("ph", hoy), p("pe", hoy, "entregado"), p("pc", hoy, "cancelado"), p("ph", hoy)],
    );
    expect(g.map((x) => [x.clave, x.items.map((y) => `${y.clase}:${y.id}`)])).toEqual([
      ["atrasados", ["pedido:pa", "turno:v"]],
      ["hoy", ["pedido:ph", "turno:h"]],
    ]);
  });
});

describe("turnosSuperpuestos", () => {
  const base = [t({ id: "a", hora: "10:00", duracionMin: 60, atiendeId: "u1" })];
  it("detecta el pisado de la misma persona", () => {
    expect(turnosSuperpuestos(base, "u1", "2026-11-24", "10:30", 30)).toHaveLength(1);
  });
  it("no pisa si empieza al terminar", () => {
    expect(turnosSuperpuestos(base, "u1", "2026-11-24", "11:00", 30)).toHaveLength(0);
  });
  it("ignora otra persona, otro día, cancelados y el excluido", () => {
    expect(turnosSuperpuestos(base, "u2", "2026-11-24", "10:00", 30)).toHaveLength(0);
    expect(turnosSuperpuestos(base, "u1", "2026-11-25", "10:00", 30)).toHaveLength(0);
    expect(turnosSuperpuestos([t({ atiendeId: "u1", estado: "cancelado" })], "u1", "2026-11-24", "10:00", 30)).toHaveLength(0);
    expect(turnosSuperpuestos(base, "u1", "2026-11-24", "10:00", 30, "a")).toHaveLength(0);
  });
  it("sin atiende no hay conflicto", () => {
    expect(turnosSuperpuestos(base, null, "2026-11-24", "10:00", 30)).toHaveLength(0);
  });
});

describe("kpisAgenda", () => {
  it("suma turnos y pedidos de hoy, pendientes, vencidos y atendidos de la semana sin duplicar ids", () => {
    const hoy = "2026-11-24";
    const p = (o: Partial<Pedido>): Pedido =>
      ({ id: "p", cliente: "Ana", clienteId: null, descripcion: "x", items: [], senaUsd: 0, fechaEntrega: hoy, estado: "pedido", nota: null, ...o }) as Pedido;
    const k = kpisAgenda(
      [
        t({ id: "1", fecha: hoy }),
        t({ id: "1", fecha: hoy }),
        t({ id: "2", fecha: "2026-11-26", estado: "pendiente" }),
        t({ id: "3", fecha: "2026-11-20", estado: "confirmado" }),
        t({ id: "4", fecha: hoy, estado: "cancelado" }),
        t({ id: "5", fecha: "2026-11-19", estado: "atendido" }),
        t({ id: "6", fecha: "2026-11-17", estado: "atendido" }),
      ],
      [
        p({ id: "a" }),
        p({ id: "a" }),
        p({ id: "b", fechaEntrega: "2026-11-20", estado: "llego" }),
        p({ id: "c", estado: "entregado" }),
        p({ id: "d", fechaEntrega: "2026-12-01" }),
      ],
      hoy,
    );
    expect(k).toEqual({
      hoy: { turnos: 1, pedidos: 1 },
      pedidosPendientes: 3,
      vencidos: { turnos: 1, pedidos: 1 },
      atendidosSemana: 1,
    });
  });
});

describe("pedidos", () => {
  const p = (o: Partial<Pedido>): Pedido => ({
    id: "p",
    cliente: "Ana",
    clienteId: null,
    descripcion: "iPhone 15",
    items: [],
    senaUsd: 0,
    fechaEntrega: "2026-11-24",
    estado: "pedido",
    ...o,
  });
  it("pedidosDelDia filtra por fecha y ordena llegó → pedido → cerrados", () => {
    const lista = [
      p({ id: "a", estado: "entregado" }),
      p({ id: "b", estado: "pedido", cliente: "Zoe" }),
      p({ id: "c", estado: "llego" }),
      p({ id: "d", estado: "cancelado" }),
      p({ id: "e", fechaEntrega: "2026-11-25" }),
    ];
    expect(pedidosDelDia(lista, "2026-11-24").map((x) => x.id)).toEqual(["c", "b", "a", "d"]);
    expect(pedidosDelDia(lista, "2026-11-24", { conCancelados: false }).map((x) => x.id)).toEqual([
      "c",
      "b",
      "a",
    ]);
  });
  it("pedidoVencido: abierto y con fecha pasada", () => {
    expect(pedidoVencido(p({ fechaEntrega: "2026-11-20" }), "2026-11-24")).toBe(true);
    expect(pedidoVencido(p({ fechaEntrega: "2026-11-20", estado: "llego" }), "2026-11-24")).toBe(true);
    expect(pedidoVencido(p({ fechaEntrega: "2026-11-20", estado: "entregado" }), "2026-11-24")).toBe(false);
    expect(pedidoVencido(p({ fechaEntrega: "2026-11-24" }), "2026-11-24")).toBe(false);
  });
});

describe("textoTurno", () => {
  it("arma el texto con equipos, página y dirección", () => {
    expect(
      textoTurno(
        { cliente: "Ana", tipo: "compra", fecha: "2026-11-26", hora: "16:00" },
        { equipos: ["iPhone 13 128GB Azul", "Funda"], tienda: "Heavenstore", direccion: "Calle 7 123" },
      ),
    ).toBe(
      [
        "Nombre: Ana",
        "Motivo: Compra equipo",
        "Equipos: iPhone 13 128GB Azul, Funda",
        "Día: jueves 26 de noviembre",
        "Horario: 16:00 hs",
        "",
        "Página: Heavenstore",
        "Dirección: Calle 7 123",
      ].join("\n"),
    );
  });

  it("sin equipos ni dirección omite esas líneas", () => {
    const txt = textoTurno(
      { cliente: "Ana", tipo: "otro", fecha: "2026-11-30", hora: "09:30" },
      { equipos: [], tienda: "Mi Local", direccion: " " },
    );
    expect(txt).not.toContain("Equipos:");
    expect(txt).not.toContain("Dirección:");
    expect(txt).toContain("Motivo: Otro");
    expect(txt.endsWith("Página: Mi Local")).toBe(true);
  });

  it("fechaLarga", () => {
    expect(fechaLarga("2026-11-30")).toBe("lunes 30 de noviembre");
  });
});
