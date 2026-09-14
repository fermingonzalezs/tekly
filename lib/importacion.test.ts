import { describe, expect, it } from "vitest";
import {
  CLIENTE_CSV_HEADERS,
  EQUIPO_CSV_HEADERS,
  clienteTemplateCsv,
  equipoTemplateCsv,
  marcarClienteDuplicadoEnArchivo,
  marcarImeiDuplicadoEnArchivo,
  parseClienteRow,
  parseEquipoRow,
  remapFilas,
} from "@/lib/importacion";

describe("parseEquipoRow", () => {
  const filaValida = {
    modelo: "iPhone 13",
    almacenamiento: "128GB",
    color: "Azul",
    imei: "353456789012345",
    bateria: "92",
    condicion: "A",
    costoUsd: "300",
    precioUsd: "450",
    estado: "disponible",
  };

  it("parsea una fila válida", () => {
    const out = parseEquipoRow(filaValida, 1);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.data.modelo).toBe("iPhone 13");
      expect(out.data.bateria).toBe(92);
      expect(out.data.costoUsd).toBe(300);
      expect(out.data.estado).toBe("disponible");
    }
  });

  it("falla si falta modelo", () => {
    const out = parseEquipoRow({ ...filaValida, modelo: "" }, 2);
    expect(out.ok).toBe(false);
  });

  it("falla con estado inválido", () => {
    const out = parseEquipoRow({ ...filaValida, estado: "reparando" }, 3);
    expect(out.ok).toBe(false);
  });

  it("falla si costoUsd no es numérico", () => {
    const out = parseEquipoRow({ ...filaValida, costoUsd: "abc" }, 4);
    expect(out.ok).toBe(false);
  });

  it("estado vacío se completa a en_revision", () => {
    const out = parseEquipoRow({ ...filaValida, estado: "" }, 5);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.data.estado).toBe("en_revision");
  });
});

describe("marcarImeiDuplicadoEnArchivo", () => {
  it("IMEI vacío nunca es duplicado", () => {
    const dup = marcarImeiDuplicadoEnArchivo([
      { rowNum: 1, imei: "" },
      { rowNum: 2, imei: "" },
    ]);
    expect(dup.size).toBe(0);
  });

  it("dos filas con el mismo IMEI: la segunda se marca", () => {
    const dup = marcarImeiDuplicadoEnArchivo([
      { rowNum: 1, imei: "111" },
      { rowNum: 2, imei: "111" },
    ]);
    expect(dup.has(1)).toBe(false);
    expect(dup.has(2)).toBe(true);
  });
});

describe("equipoTemplateCsv", () => {
  it("cada línea tiene la misma cantidad de columnas que el header (ninguna nota lleva coma)", () => {
    const lineas = equipoTemplateCsv().split("\n");
    const cols = lineas[0].split(",").length;
    for (const linea of lineas) expect(linea.split(",")).toHaveLength(cols);
  });

  it("la columna extra 'notas' no rompe el parseo de la fila de ejemplo", () => {
    const headers = equipoTemplateCsv().split("\n")[0].split(",");
    const ejemplo = equipoTemplateCsv().split("\n")[1].split(",");
    const raw = Object.fromEntries(headers.map((h, i) => [h, ejemplo[i]]));
    const remap = remapFilas(EQUIPO_CSV_HEADERS, [raw]);
    expect(remap.ok).toBe(true);
    if (remap.ok) {
      const out = parseEquipoRow(remap.filas[0], 1);
      expect(out.ok).toBe(true);
    }
  });
});

describe("clienteTemplateCsv", () => {
  it("cada línea tiene la misma cantidad de columnas que el header (ninguna nota lleva coma)", () => {
    const lineas = clienteTemplateCsv().split("\n");
    const cols = lineas[0].split(",").length;
    for (const linea of lineas) expect(linea.split(",")).toHaveLength(cols);
  });

  it("la columna extra 'notas' no rompe el parseo de la fila de ejemplo", () => {
    const headers = clienteTemplateCsv().split("\n")[0].split(",");
    const ejemplo = clienteTemplateCsv().split("\n")[1].split(",");
    const raw = Object.fromEntries(headers.map((h, i) => [h, ejemplo[i]]));
    const remap = remapFilas(CLIENTE_CSV_HEADERS, [raw]);
    expect(remap.ok).toBe(true);
    if (remap.ok) {
      const out = parseClienteRow(remap.filas[0], 1);
      expect(out.ok).toBe(true);
    }
  });
});

describe("remapFilas", () => {
  it("remapea headers con casing distinto a los canónicos exactos", () => {
    const out = remapFilas(CLIENTE_CSV_HEADERS, [
      { Nombre: "Juan", Telefono: "111", Email: "a@b.com", FechaNacimiento: "" },
    ]);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.filas[0]).toEqual({ nombre: "Juan", telefono: "111", email: "a@b.com", fechaNacimiento: "" });
  });

  it("reporta headers faltantes", () => {
    const out = remapFilas(CLIENTE_CSV_HEADERS, [{ nombre: "Juan" }]);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.faltantes).toContain("telefono");
  });

  it("archivo vacío no falla", () => {
    const out = remapFilas(CLIENTE_CSV_HEADERS, []);
    expect(out.ok).toBe(true);
  });
});

describe("parseClienteRow", () => {
  const filaValida = { nombre: "Juan Perez", telefono: "111", email: "a@b.com", fechaNacimiento: "" };

  it("parsea una fila válida sin fecha", () => {
    const out = parseClienteRow(filaValida, 1);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.data.fechaNacimiento).toBeUndefined();
  });

  it("falla si falta nombre", () => {
    const out = parseClienteRow({ ...filaValida, nombre: "" }, 2);
    expect(out.ok).toBe(false);
  });

  it("fecha DD/MM/AAAA válida se normaliza a ISO", () => {
    const out = parseClienteRow({ ...filaValida, fechaNacimiento: "15/05/1990" }, 3);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.data.fechaNacimiento).toBe("1990-05-15");
  });

  it("fecha AAAA-MM-DD válida se acepta tal cual", () => {
    const out = parseClienteRow({ ...filaValida, fechaNacimiento: "1990-05-15" }, 4);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.data.fechaNacimiento).toBe("1990-05-15");
  });

  it("fecha inválida (31/13/2020) es un error", () => {
    const out = parseClienteRow({ ...filaValida, fechaNacimiento: "31/13/2020" }, 5);
    expect(out.ok).toBe(false);
  });
});

describe("marcarClienteDuplicadoEnArchivo", () => {
  it("dos filas con el mismo teléfono: la segunda se marca", () => {
    const dup = marcarClienteDuplicadoEnArchivo([
      { rowNum: 1, telefono: "111", email: "" },
      { rowNum: 2, telefono: "111", email: "" },
    ]);
    expect(dup.has(1)).toBe(false);
    expect(dup.has(2)).toBe(true);
  });

  it("match por email aunque el teléfono sea distinto", () => {
    const dup = marcarClienteDuplicadoEnArchivo([
      { rowNum: 1, telefono: "111", email: "A@B.com" },
      { rowNum: 2, telefono: "222", email: "a@b.com" },
    ]);
    expect(dup.has(2)).toBe(true);
  });

  it("sin teléfono ni email, no hay match", () => {
    const dup = marcarClienteDuplicadoEnArchivo([
      { rowNum: 1, telefono: "", email: "" },
      { rowNum: 2, telefono: "", email: "" },
    ]);
    expect(dup.size).toBe(0);
  });
});
