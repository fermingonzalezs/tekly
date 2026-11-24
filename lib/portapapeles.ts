// Tabla → formatos de portapapeles que una planilla (Google Sheets, Excel)
// pega en columnas. Puro: el acceso al portapapeles vive en el componente.

/** Texto plano separado por tabs. Tabs y saltos de línea dentro de una celda
 * se reemplazan por espacios (si no, partirían la fila o la columna). */
export function tablaATsv(filas: string[][]): string {
  return filas
    .map((fila) => fila.map((c) => (c ?? "").replace(/[\t\r\n]+/g, " ")).join("\t"))
    .join("\n");
}

const escaparHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** `<table>` HTML: Sheets lo prioriza sobre el texto plano y respeta cada
 * celda tal cual (comillas, comas, saltos de línea). */
export function tablaAHtml(filas: string[][]): string {
  const cuerpo = filas
    .map((fila) => `<tr>${fila.map((c) => `<td>${escaparHtml(c ?? "")}</td>`).join("")}</tr>`)
    .join("");
  return `<table>${cuerpo}</table>`;
}
