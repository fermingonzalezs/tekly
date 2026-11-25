"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import Papa from "papaparse";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Plus,
  RotateCcw,
  Trash2,
  FileSpreadsheet,
  Laptop,
  Smartphone,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { VarianteDialog } from "@/components/inventario/variante-dialog";
import {
  agruparPorGrupo,
  buscarVariante,
  claveVariante,
  nombreVariante,
  ordenarGrupos,
} from "@/lib/variantes";
import type { Variante, VarianteCategoria } from "@/lib/types";
import { Input, Select, Textarea } from "@/components/ui/field";
import { IA_MAX_CARACTERES, etiquetaLecturasRestantes, type EntidadImportacion } from "@/lib/ia-lecturas";
import { useVolverAlOnboarding } from "@/components/onboarding/volver-al-onboarding";
import { dotClass, type Tone } from "@/lib/status";
import {
  CLIENTE_CSV_HEADERS,
  CELULAR_CSV_HEADERS,
  COLUMNAS_CELULAR,
  COLUMNAS_CLIENTE,
  COLUMNAS_NOTEBOOK,
  completarFila,
  montoParaMostrar,
  opcionDe,
  ordenColumnas,
  type ColumnaImport,
  NOTEBOOK_CSV_HEADERS,
  notebookTemplateCsv,
  parseNotebookRow,
  marcarSerieDuplicadaEnArchivo,
  clienteTemplateCsv,
  celularTemplateCsv,
  marcarClienteDuplicadoEnArchivo,
  marcarImeiDuplicadoEnArchivo,
  parseClienteRow,
  parseCelularRow,
  remapFilas,
  evaluarFilas,
  type ClienteImportInput,
  type EstadoFilaPreview,
  type FilaCruda,
  type ParseResult,
} from "@/lib/importacion";
import type { CelularInput } from "@/lib/db/inventario";
import type { NotebookInput } from "@/lib/notebooks";
import {
  importClientesAction,
  importCelularesAction,
  importNotebooksAction,
  leerConIaAction,
  retomarLecturaIaAction,
  type ImportResult,
} from "./actions";
import type { ComponentType } from "react";
import { tablaAHtml, tablaATsv } from "@/lib/portapapeles";

function descargar(contenido: string, filename: string) {
  const blob = new Blob([contenido], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Copia una tabla al portapapeles como HTML + TSV, **sincrónico** dentro del
 * click (`execCommand("copy")` + evento `copy`), así no depende de que la
 * página conserve el foco. Devuelve si se pudo copiar. */
function copiarTabla(filas: string[][]): boolean {
  const tsv = tablaATsv(filas);
  const html = tablaAHtml(filas);
  const alCopiar = (e: ClipboardEvent) => {
    e.preventDefault();
    e.clipboardData?.setData("text/plain", tsv);
    e.clipboardData?.setData("text/html", html);
  };
  document.addEventListener("copy", alCopiar);
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.removeEventListener("copy", alCopiar);
  }
}

/** Abre una planilla nueva de Google Sheets. No se abre sola al copiar la
 * plantilla: el navegador traería la pestaña nueva al frente y taparía el
 * modal con los pasos (no hay forma confiable de abrir una pestaña en el
 * fondo desde JS). Se abre desde el botón del modal, cuando ya se leyó.
 * `opener = null` corta el acceso de la planilla a esta ventana (mismo
 * resguardo que `noopener`, pero sin perder el handle). */
function abrirPlanillaNueva() {
  const ventana = window.open("https://sheets.new", "_blank");
  if (ventana) ventana.opener = null;
}

function Chip({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass[tone]}`} />
      {label}
    </span>
  );
}

function ResultadoLista({
  rows,
}: {
  rows: { rowNum: number; status: "ok" | "error" | "duplicate" | "imported"; detail?: string }[];
}) {
  const problemas = rows.filter((r) => r.status !== "ok" && r.status !== "imported");
  if (problemas.length === 0) return null;
  return (
    <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg bg-neutral-50 p-2 text-[11px]">
      {problemas.map((r) => (
        <p key={r.rowNum} className={r.status === "error" ? "text-red-600" : "text-amber-600"}>
          Fila {r.rowNum}: {r.detail}
        </p>
      ))}
    </div>
  );
}

const TONO_ESTADO: Record<EstadoFilaPreview["status"], { tone: Tone; label: string }> = {
  ok: { tone: "green", label: "Lista" },
  error: { tone: "red", label: "Error" },
  duplicate: { tone: "amber", label: "Duplicada" },
};

const CELDA = "h-8 min-w-[7.5rem] px-2 text-center text-xs";

/** Monto en dólares: `U$ 1.300` a la vista; al editar, solo dígitos. */
function MontoCelda({
  valor,
  onChange,
  ariaLabel,
}: {
  valor: string;
  onChange: (v: string) => void;
  ariaLabel: string;
}) {
  const [editando, setEditando] = useState(false);
  return (
    <Input
      inputMode="numeric"
      value={editando ? valor : montoParaMostrar(valor)}
      placeholder="U$ 0"
      onFocus={() => setEditando(true)}
      onBlur={() => setEditando(false)}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      aria-label={ariaLabel}
      className={`${CELDA} tabular-nums`}
    />
  );
}

/** Preview editable: una fila por equipo/cliente, una columna por campo de la
 * plantilla (`estado` primero). La validez de cada fila no ocupa una columna:
 * va como un punto al lado del número y, si hay problema, en una línea debajo.
 * Cada cambio recalcula el estado de las filas (`evaluarFilas`). */
function TablaEditable({
  headers,
  columnas,
  filas,
  estados,
  onCambiar,
  onQuitar,
  orden: ordenProp,
  renderCeldaExtra,
  bloqueadas,
}: {
  headers: readonly string[];
  columnas: Record<string, ColumnaImport>;
  filas: FilaCruda[];
  estados: EstadoFilaPreview[];
  onCambiar: (rowNum: number, campo: string, valor: string) => void;
  onQuitar: (rowNum: number) => void;
  /** Orden de columnas ya resuelto (celulares mete la virtual «varianteId»). */
  orden?: string[];
  /** Celda propia por columna (la variante, que no es un input de texto). */
  renderCeldaExtra?: (campo: string, fila: FilaCruda) => React.ReactNode | null;
  /** Columnas de solo lectura para esa fila (datos que define la variante). */
  bloqueadas?: (fila: FilaCruda) => string[];
}) {
  const orden = ordenProp ?? ordenColumnas(headers);
  return (
    <div className="max-h-[28rem] overflow-auto rounded-xl border border-neutral-200">
      <table className="w-full text-center text-xs">
        <thead className="sticky top-0 z-10">
          <tr className="text-xs">
            <th className="px-2 py-2">#</th>
            {orden.map((h) => (
              <th key={h} className="whitespace-nowrap px-2 py-2">
                {columnas[h]?.label ?? h}
              </th>
            ))}
            <th className="px-2 py-2">
              <span className="sr-only">Quitar</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => {
            const estado = estados[i];
            const tono = TONO_ESTADO[estado.status];
            return (
              <Fragment key={fila.rowNum}>
                <tr>
                  <td className="px-2 py-1.5">
                    <span
                      className="inline-flex items-center gap-1.5 tabular-nums text-neutral-500"
                      title={estado.detail ?? tono.label}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${dotClass[tono.tone]}`} />
                      {fila.rowNum}
                      <span className="sr-only">{tono.label}</span>
                    </span>
                  </td>
                  {orden.map((h) => {
                    const col = columnas[h] ?? { label: h };
                    const valor = fila.raw[h] ?? "";
                    const label = `${col.label}, fila ${fila.rowNum}`;
                    const cambiar = (v: string) => onCambiar(fila.rowNum, h, v);
                    const extra = renderCeldaExtra?.(h, fila);
                    if (extra) {
                      return (
                        <td key={h} className="px-1 py-1.5">
                          {extra}
                        </td>
                      );
                    }
                    if (col.monto) {
                      return (
                        <td key={h} className="px-1 py-1.5">
                          <MontoCelda valor={valor} onChange={cambiar} ariaLabel={label} />
                        </td>
                      );
                    }
                    if (col.opciones) {
                      // Si lo que vino no es ninguna opción, queda a la vista como
                      // «valor» para que se vea qué había, y la fila marca el error.
                      const elegida = opcionDe(col, valor);
                      return (
                        <td key={h} className="px-1 py-1.5">
                          <Select
                            value={elegida?.value ?? ""}
                            onChange={(e) => cambiar(e.target.value)}
                            aria-label={label}
                            className={`${CELDA} [text-align-last:center]`}
                          >
                            {!elegida && (
                              <option value="" disabled>
                                {valor.trim() ? `«${valor.trim()}» · elegí` : "Elegí…"}
                              </option>
                            )}
                            {col.opciones.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </Select>
                        </td>
                      );
                    }
                    const noAplica =
                      (col.deshabilitada?.(fila.raw) ?? false) ||
                      (bloqueadas?.(fila) ?? []).includes(h);
                    return (
                      <td key={h} className="px-1 py-1.5">
                        <Input
                          value={noAplica ? "" : valor}
                          disabled={noAplica}
                          placeholder={noAplica ? "No aplica" : undefined}
                          inputMode={col.entero ? "numeric" : undefined}
                          onChange={(e) =>
                            cambiar(col.entero ? e.target.value.replace(/\D/g, "") : e.target.value)
                          }
                          aria-label={label}
                          className={col.entero ? `${CELDA} tabular-nums` : CELDA}
                        />
                      </td>
                    );
                  })}
                  <td className="px-1 py-1.5">
                    <IconButton
                      aria-label={`Quitar fila ${fila.rowNum}`}
                      icon={Trash2}
                      variant="danger-ghost"
                      size="sm"
                      onClick={() => onQuitar(fila.rowNum)}
                    />
                  </td>
                </tr>
                {estado.detail && (
                  <tr>
                    <td
                      colSpan={orden.length + 2}
                      className={`px-2 pb-2 pt-0 text-[11px] leading-tight ${estado.status === "error" ? "text-red-600" : "text-amber-700"}`}
                    >
                      Fila {fila.rowNum} · {tono.label}: {estado.detail}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Tarjeta de import genérica -- comparte el flujo cargar (CSV o texto leído
 * con IA) → tabla editable (parseo + dedupe client-side, recalculado en cada
 * cambio) → confirmar (la Server Action revalida todo de nuevo) → resultado,
 * para celulares, notebooks y clientes. Cada instancia sólo aporta el
 * schema/dedupe/action de su dominio (`lib/importacion.ts`). */
function ImportCard<T>({
  titulo,
  descripcion,
  icon: Icon,
  headers,
  columnas,
  templateCsv,
  templateFilename,
  parseRow,
  marcarDuplicados,
  action,
  entidad,
  iaRestantes,
  onIaRestantes,
  variantes,
}: {
  entidad: EntidadImportacion;
  iaRestantes: number;
  onIaRestantes: (restantes: number) => void;
  titulo: string;
  descripcion: string;
  icon: ComponentType<{ className?: string }>;
  headers: readonly string[];
  /** Título, desplegable, monto y "no aplica" de cada columna. */
  columnas: Record<string, ColumnaImport>;
  templateCsv: () => string;
  templateFilename: string;
  parseRow: (raw: Record<string, string>, rowNum: number) => ParseResult<T>;
  marcarDuplicados: (validos: { rowNum: number; data: T }[]) => Map<number, string>;
  action: (rows: FilaCruda[]) => Promise<ImportResult>;
  /** Celulares y notebooks: variantes para elegir por fila (obligatoria).
   * Pueden venir de todas las categorías: se usan las de la entidad. */
  variantes?: Variante[];
}) {
  const [estado, setEstado] = useState<"idle" | "preview" | "done">("idle");
  const [filas, setFilas] = useState<FilaCruda[]>([]);
  const [origen, setOrigen] = useState<"csv" | "ia">("csv");
  const [resultado, setResultado] = useState<ImportResult | null>(null);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [modoIa, setModoIa] = useState(false);
  const [textoIa, setTextoIa] = useState("");
  const [leyendo, startLectura] = useTransition();
  const [ayudaPlanilla, setAyudaPlanilla] = useState<"pegar" | "csv" | null>(null);
  const categoriaVariante: VarianteCategoria = entidad === "notebooks" ? "notebook" : "celular";
  const [listaVariantes, setListaVariantes] = useState<Variante[]>(
    (variantes ?? []).filter((v) => v.categoria === categoriaVariante),
  );
  const [creandoVariante, setCreandoVariante] = useState<FilaCruda | null>(null);
  const volverAlOnboarding = useVolverAlOnboarding();

  const conVariantes = variantes !== undefined;
  const varianteDe = (fila: FilaCruda) =>
    listaVariantes.find((v) => v.id === (fila.raw.varianteId ?? "")) ?? null;
  const gruposVariantes = ordenarGrupos(
    agruparPorGrupo(listaVariantes.filter((v) => v.activa)),
  );

  /** Columnas de la fila que define la variante (y que la fila no puede
   * editar mientras la tenga elegida). */
  function camposDeVariante(variante: Variante): Record<string, string> {
    if (variante.categoria === "notebook") {
      return {
        modelo: variante.modelo,
        memoria: variante.memoria,
        almacenamiento: variante.almacenamiento,
        condicion: variante.condicion,
      };
    }
    return {
      modelo: variante.modelo,
      almacenamiento: variante.almacenamiento,
      condicion: variante.condicion,
      ...(variante.color ? { color: variante.color } : {}),
    };
  }

  /** Datos clave de una fila, para sugerir/agrupar por variante. */
  function datosDeFila(raw: Record<string, string>) {
    return {
      categoria: categoriaVariante,
      modelo: raw.modelo ?? "",
      memoria: raw.memoria ?? "",
      almacenamiento: raw.almacenamiento ?? "",
      condicion: raw.condicion ?? "",
      color: categoriaVariante === "notebook" ? "" : (raw.color ?? ""),
    };
  }

  /** Copia a la fila los datos clave de la variante elegida (el precio de la
   * planilla se respeta: `precioPropio: true`). */
  function aplicarVariante(rowNum: number, varianteId: string) {
    const variante = listaVariantes.find((v) => v.id === varianteId);
    if (!variante) return;
    setFilas((prev) =>
      prev.map((f) =>
        f.rowNum === rowNum
          ? {
              ...f,
              raw: {
                ...f.raw,
                varianteId: variante.id,
                ...camposDeVariante(variante),
              },
            }
          : f,
      ),
    );
  }

  const estados = useMemo(
    () => evaluarFilas(filas, parseRow, marcarDuplicados),
    [filas, parseRow, marcarDuplicados],
  );

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErrorArchivo(null);

    const texto = await file.text();
    const csv = Papa.parse<Record<string, string>>(texto, { header: true, skipEmptyLines: true });
    const remap = remapFilas(headers, csv.data);
    if (!remap.ok) {
      setErrorArchivo(`Faltan columnas en el CSV: ${remap.faltantes.join(", ")}`);
      return;
    }
    armarPreview(remap.filas, "csv");
  }

  /** Mismo preview editable para un CSV subido y para las filas de la IA. */
  function armarPreview(filasRaw: Record<string, string>[], desde: "csv" | "ia") {
    setFilas(
      filasRaw.map((raw, i) => {
        const filaRaw = completarFila(
          Object.fromEntries(headers.map((h) => [h, raw[h] ?? ""])),
          columnas,
        );
        if (conVariantes) {
          // Sugerencia: la variante activa que coincide con los datos de la
          // fila (la primera con su color y, si no, la de cualquier color).
          const sugerida = buscarVariante(listaVariantes, datosDeFila(filaRaw));
          filaRaw.varianteId = sugerida?.id ?? "";
        }
        return { rowNum: i + 1, raw: filaRaw };
      }),
    );
    setOrigen(desde);
    setEstado("preview");
  }

  function cambiarCelda(rowNum: number, campo: string, valor: string) {
    setFilas((prev) =>
      prev.map((f) =>
        f.rowNum === rowNum ? { ...f, raw: completarFila({ ...f.raw, [campo]: valor }, columnas) } : f,
      ),
    );
  }

  function quitarFila(rowNum: number) {
    setFilas((prev) => prev.filter((f) => f.rowNum !== rowNum));
  }

  function leerConIa() {
    setErrorArchivo(null);
    startLectura(async () => {
      const res = await leerConIaAction(entidad, textoIa);
      onIaRestantes(res.restantes);
      if (!res.ok) {
        setErrorArchivo(res.error);
        return;
      }
      setModoIa(false);
      setTextoIa("");
      armarPreview(res.filas, "ia");
    });
  }

  function retomarLectura() {
    setErrorArchivo(null);
    startLectura(async () => {
      const guardadas = await retomarLecturaIaAction(entidad);
      if (!guardadas?.length) {
        setErrorArchivo("No se encontró la lectura con IA guardada.");
        return;
      }
      armarPreview(guardadas, "ia");
    });
  }

  /** Copia la plantilla al portapapeles y explica en un modal cómo cargarla
   * en una planilla nueva. Sheets no acepta datos por URL: la planilla nace
   * vacía y se pega a mano. La pestaña de Sheets la abre el botón del modal
   * (`abrirPlanillaNueva`), no este click: si se abriera acá, el navegador la
   * traería al frente y el modal quedaría detrás. La copia es sincrónica y
   * sale dentro del click; si falla no se abre el modal y se avisa. */
  function abrirEnSheets() {
    setErrorArchivo(null);
    const filas = Papa.parse<string[]>(templateCsv(), { skipEmptyLines: true }).data;
    if (!copiarTabla(filas)) {
      setErrorArchivo(
        "No se pudo copiar la plantilla. Descargá el CSV y abrilo en Google Sheets (Archivo → Importar).",
      );
      return;
    }
    setAyudaPlanilla("pegar");
  }

  /** Descarga el CSV y abre el mismo modal de ayuda, con los pasos para
   * importarlo en una planilla (Google Sheets, Excel o Numbers). */
  function descargarPlantilla() {
    descargar(templateCsv(), templateFilename);
    setAyudaPlanilla("csv");
  }

  function confirmar() {
    startTransition(async () => {
      const res = await action(filas);
      // Con errores se queda acá para que se vea el detalle de cada fila.
      if (res.errors === 0 && res.inserted > 0 && (await volverAlOnboarding())) return;
      setResultado(res);
      setEstado("done");
    });
  }

  function reiniciar() {
    setEstado("idle");
    setFilas([]);
    setResultado(null);
    setErrorArchivo(null);
  }

  /** Celda de la columna virtual «variante»: selector agrupado + alta con los
   * datos de la fila. */
  function celdaVariante(fila: FilaCruda) {
    const actual = varianteDe(fila);
    return (
      <Select
        value={actual?.id ?? ""}
        onChange={(e) => {
          if (e.target.value === "__nueva") {
            setCreandoVariante(fila);
            return;
          }
          aplicarVariante(fila.rowNum, e.target.value);
        }}
        aria-label={`Variante, fila ${fila.rowNum}`}
        className={`${CELDA} min-w-[12rem] [text-align-last:center]`}
      >
        <option value="" disabled>
          Elegí…
        </option>
        {gruposVariantes.map((g) => (
          <optgroup key={g.clave} label={g.grupo}>
            {g.variantes.map((v) => (
              <option key={v.id} value={v.id}>
                {v.sku} · {nombreVariante(v)}
              </option>
            ))}
          </optgroup>
        ))}
        <option value="__nueva">+ Nueva variante con estos datos</option>
      </Select>
    );
  }

  const validas = estados.filter((f) => f.status === "ok").length;
  const conError = estados.filter((f) => f.status === "error").length;
  const duplicadas = estados.filter((f) => f.status === "duplicate").length;

  return (
    <Card className={estado === "idle" ? "p-5" : "p-5 lg:col-span-2"}>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900">{titulo}</p>
              <p className="text-[13px] text-neutral-500">{descripcion}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" icon={FileSpreadsheet} onClick={abrirEnSheets}>
              Google Sheets
            </Button>
            <Button variant="outline" size="sm" icon={Download} onClick={descargarPlantilla}>
              CSV
            </Button>
          </div>
        </div>

        {estado === "idle" && modoIa && (
          <div className="space-y-2">
            <Textarea
              value={textoIa}
              onChange={(e) => setTextoIa(e.target.value)}
              rows={8}
              maxLength={IA_MAX_CARACTERES}
              placeholder="Pegá acá tu lista tal como la tenés (WhatsApp, Excel, notas…). Una línea por equipo o cliente funciona mejor."
              aria-label={`Texto para leer con IA: ${titulo.toLowerCase()}`}
            />
            <p className="text-xs text-neutral-500">
              {textoIa.length.toLocaleString("es-AR")} / {IA_MAX_CARACTERES.toLocaleString("es-AR")}{" "}
              caracteres · Tenés una sola lectura para este tipo: pegá la lista completa.
            </p>
            {errorArchivo && <p className="text-xs text-red-600">{errorArchivo}</p>}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setModoIa(false);
                  setErrorArchivo(null);
                }}
                disabled={leyendo}
              >
                Cancelar
              </Button>
              <Button icon={Sparkles} onClick={leerConIa} loading={leyendo} disabled={!textoIa.trim()}>
                {leyendo ? "Leyendo…" : "Leer con IA"}
              </Button>
            </div>
          </div>
        )}

        {estado === "idle" && !modoIa && (
          <div className="space-y-2">
            <label className="group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50 px-4 py-8 text-center transition-colors hover:border-accent/40 hover:bg-accent-soft/40">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-accent shadow-sm ring-1 ring-neutral-200 transition-colors group-hover:ring-accent/30">
                <Upload className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-700">Elegir archivo CSV</p>
                <p className="text-xs text-neutral-500">Usá la plantilla para respetar las columnas</p>
              </div>
              <input type="file" accept=".csv" onChange={onFile} className="sr-only" />
            </label>
            {errorArchivo && <p className="text-xs text-red-600">{errorArchivo}</p>}
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center">
              {iaRestantes > 0 ? (
                <>
                  <Button
                    variant="link"
                    icon={Sparkles}
                    onClick={() => {
                      setModoIa(true);
                      setErrorArchivo(null);
                    }}
                  >
                    Pegar texto y leer con IA
                  </Button>
                  <span className="text-xs text-neutral-500">{etiquetaLecturasRestantes(iaRestantes)}</span>
                </>
              ) : (
                <>
                  <Button variant="link" icon={RotateCcw} onClick={retomarLectura} loading={leyendo}>
                    Retomar la lectura con IA
                  </Button>
                  <span className="text-xs text-neutral-500">Ya usaste la lectura de este tipo</span>
                </>
              )}
            </div>
          </div>
        )}

        {estado === "preview" && (
          <div className="space-y-3">
            <p className="text-[13px] text-neutral-600">
              {origen === "ia"
                ? "Esto es lo que leyó la IA. Revisá y corregí cada dato antes de importar: nada se guarda hasta que confirmes."
                : "Revisá y corregí los datos antes de importar: nada se guarda hasta que confirmes."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Chip tone="green" label={`${validas} listas`} />
              {duplicadas > 0 && <Chip tone="amber" label={`${duplicadas} duplicadas`} />}
              {conError > 0 && <Chip tone="red" label={`${conError} con error`} />}
            </div>
            <TablaEditable
              headers={headers}
              columnas={columnas}
              filas={filas}
              estados={estados}
              onCambiar={cambiarCelda}
              onQuitar={quitarFila}
              orden={
                conVariantes
                  ? ["estado", "varianteId", ...headers.filter((h) => h !== "estado")]
                  : undefined
              }
              renderCeldaExtra={
                conVariantes
                  ? (campo, fila) => (campo === "varianteId" ? celdaVariante(fila) : null)
                  : undefined
              }
              bloqueadas={
                conVariantes
                  ? (fila) => {
                      const variante = varianteDe(fila);
                      if (!variante) return [];
                      return Object.keys(camposDeVariante(variante));
                    }
                  : undefined
              }
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={reiniciar} disabled={pending}>
                Cancelar
              </Button>
              <Button onClick={confirmar} disabled={validas === 0} loading={pending}>
                {pending ? "Importando…" : `Importar ${validas} ${validas === 1 ? "fila" : "filas"}`}
              </Button>
            </div>
            {conError + duplicadas > 0 && (
              <p className="text-xs text-neutral-500">
                Las filas con error o duplicadas no se importan: corregilas o quitalas.
              </p>
            )}
          </div>
        )}

        {estado === "done" && resultado && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              <p className="text-sm font-medium">Importación completa</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Chip tone="green" label={`${resultado.inserted} importados`} />
              {resultado.skipped > 0 && <Chip tone="amber" label={`${resultado.skipped} omitidos (duplicados)`} />}
              {resultado.errors > 0 && <Chip tone="red" label={`${resultado.errors} con error`} />}
            </div>
            <ResultadoLista rows={resultado.rows} />
            <Button variant="outline" onClick={reiniciar}>
              Importar otro archivo
            </Button>
          </div>
        )}
      </div>

      <AyudaPlanillaDialog
        modo={ayudaPlanilla ?? "pegar"}
        abierto={ayudaPlanilla !== null}
        filename={templateFilename}
        onClose={() => setAyudaPlanilla(null)}
      />

      {creandoVariante && (
        <VarianteDialog
          key={`import-variante-${creandoVariante.rowNum}`}
          open
          categoria={categoriaVariante}
          onClose={() => setCreandoVariante(null)}
          inicial={{
            grupo: creandoVariante.raw.modelo ?? "",
            modelo: creandoVariante.raw.modelo ?? "",
            memoria: creandoVariante.raw.memoria ?? "",
            almacenamiento: creandoVariante.raw.almacenamiento ?? "",
            condicion: creandoVariante.raw.condicion ?? "",
            color: creandoVariante.raw.color ?? "",
          }}
          grupos={gruposVariantes.map((g) => g.grupo)}
          skus={listaVariantes.map((v) => v.sku)}
          onSaved={(v) => {
            const clave = claveVariante(v);
            const coincide = (f: FilaCruda) => {
              const datos = datosDeFila(f.raw);
              return (
                claveVariante(datos) === clave ||
                (v.color === "" && claveVariante({ ...datos, color: "" }) === clave)
              );
            };
            setListaVariantes((prev) => [...prev, v]);
            setFilas((prev) =>
              prev.map((f) =>
                !f.raw.varianteId && coincide(f)
                  ? {
                      ...f,
                      raw: {
                        ...f.raw,
                        varianteId: v.id,
                        ...camposDeVariante(v),
                      },
                    }
                  : f,
              ),
            );
            setCreandoVariante(null);
          }}
        />
      )}
    </Card>
  );
}

/** Ayuda de la plantilla: un solo modal para las dos vías. `pegar` explica
 * cómo pegar lo que quedó en el portapapeles en una planilla nueva; `csv`
 * explica cómo importar el archivo descargado. El cierre del flujo
 * (completar, descargar CSV, subirlo acá) es el mismo en los dos. */
function AyudaPlanillaDialog({
  abierto,
  modo,
  filename,
  onClose,
}: {
  abierto: boolean;
  modo: "pegar" | "csv";
  filename: string;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={abierto}
      onClose={onClose}
      title="Cómo cargar la planilla"
      description={
        modo === "pegar"
          ? "Copiamos la plantilla: creá una planilla nueva y pegala en A1."
          : `Descargamos ${filename} con las columnas de la plantilla.`
      }
      size="lg"
      footer={
        <>
          <Button variant="outline" fullOnMobile onClick={onClose} className="sm:ml-auto">
            Cerrar
          </Button>
          <Button variant="primary" fullOnMobile icon={ExternalLink} onClick={abrirPlanillaNueva}>
            Abrir planilla
          </Button>
        </>
      }
    >
      <ol className="list-decimal space-y-2.5 pl-5 text-start text-[13px] text-neutral-700">
        {modo === "pegar" ? (
          <li>
            Tocá <strong>Abrir planilla</strong> acá abajo: se crea una planilla nueva de Google
            Sheets en otra pestaña.
          </li>
        ) : (
          <>
            <li>
              Tocá <strong>Abrir planilla</strong> acá abajo y andá a{" "}
              <strong>Archivo → Importar</strong>.
            </li>
            <li>
              Elegí <strong>Subir</strong> y seleccioná{" "}
              <code className="font-mono">{filename}</code>.
            </li>
            <li>
              Dejá el separador en <strong>Detectar automáticamente</strong> y elegí{" "}
              <strong>Reemplazar hoja de cálculo</strong>.
            </li>
          </>
        )}
        {modo === "pegar" && (
          <li>
            En la planilla, tocá la celda <strong>A1</strong> y pegá con <strong>Ctrl+V</strong> (
            <strong>⌘V</strong> en Mac): la plantilla entra en columnas.
          </li>
        )}
        <li>
          Cargá una fila por equipo (o cliente). Borrá la fila de ejemplo y las filas de notas de
          abajo.
        </li>
        <li>
          Bajala con <strong>Archivo → Descargar → CSV</strong> (en Excel o Numbers, «Guardar
          como» CSV).
        </li>
        <li>
          Volvé acá y subila con <strong>Elegir archivo CSV</strong>.
        </li>
      </ol>
      <p className="mt-3 text-xs text-neutral-500">
        Las columnas tienen que quedar como en la plantilla: la importación lee cada dato por
        nombre de columna, no por posición.
      </p>
    </Dialog>
  );
}

export function ImportarDatos({
  iaRestantes: iaRestantesInicial,
  variantes,
}: {
  iaRestantes: Record<EntidadImportacion, number>;
  /** Variantes de celulares y notebooks (obligatorias al importar). */
  variantes: Variante[];
}) {
  // Una lectura con IA por tipo: lo actualiza la respuesta de cada lectura.
  const [iaRestantes, setIaRestantes] = useState(iaRestantesInicial);
  const ia = (entidad: EntidadImportacion) => ({
    iaRestantes: iaRestantes[entidad],
    onIaRestantes: (n: number) => setIaRestantes((prev) => ({ ...prev, [entidad]: n })),
  });
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ImportCard<CelularInput>
        titulo="Importar celulares"
        descripcion="Alta masiva de celulares existentes por IMEI"
        icon={Smartphone}
        headers={CELULAR_CSV_HEADERS}
        columnas={COLUMNAS_CELULAR}
        templateCsv={celularTemplateCsv}
        variantes={variantes}
        entidad="celulares"
        {...ia("celulares")}
        templateFilename="plantilla-celulares.csv"
        parseRow={parseCelularRow}
        marcarDuplicados={(validos) =>
          marcarImeiDuplicadoEnArchivo(validos.map((v) => ({ rowNum: v.rowNum, imei: v.data.imei })))
        }
        action={importCelularesAction}
      />
      <ImportCard<NotebookInput>
        titulo="Importar notebooks"
        descripcion="Alta masiva de notebooks existentes por número de serie"
        icon={Laptop}
        headers={NOTEBOOK_CSV_HEADERS}
        columnas={COLUMNAS_NOTEBOOK}
        templateCsv={notebookTemplateCsv}
        variantes={variantes}
        entidad="notebooks"
        {...ia("notebooks")}
        templateFilename="plantilla-notebooks.csv"
        parseRow={parseNotebookRow}
        marcarDuplicados={(validos) =>
          marcarSerieDuplicadaEnArchivo(
            validos.map((v) => ({ rowNum: v.rowNum, numeroSerie: v.data.numeroSerie })),
          )
        }
        action={importNotebooksAction}
      />
      <ImportCard<ClienteImportInput>
        titulo="Importar clientes"
        descripcion="Alta masiva de clientes existentes"
        icon={Users}
        headers={CLIENTE_CSV_HEADERS}
        columnas={COLUMNAS_CLIENTE}
        templateCsv={clienteTemplateCsv}
        entidad="clientes"
        {...ia("clientes")}
        templateFilename="plantilla-clientes.csv"
        parseRow={parseClienteRow}
        marcarDuplicados={(validos) =>
          marcarClienteDuplicadoEnArchivo(
            validos.map((v) => ({ rowNum: v.rowNum, telefono: v.data.telefono, email: v.data.email })),
          )
        }
        action={importClientesAction}
      />
    </div>
  );
}
