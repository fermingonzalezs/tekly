"use client";

import { useMemo, useState, useTransition } from "react";
import Papa from "papaparse";
import {
  CheckCircle2,
  Download,
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
import { Input, Textarea } from "@/components/ui/field";
import { IA_MAX_CARACTERES, type EntidadImportacion } from "@/lib/ia-lecturas";
import { useVolverAlOnboarding } from "@/components/onboarding/volver-al-onboarding";
import { dotClass, type Tone } from "@/lib/status";
import {
  CLIENTE_CSV_HEADERS,
  CELULAR_CSV_HEADERS,
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

function descargar(contenido: string, filename: string) {
  const blob = new Blob([contenido], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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

/** Preview editable: una fila por equipo/cliente, una columna por campo de la
 * plantilla. Cada cambio recalcula el estado de las filas (`evaluarFilas`). */
function TablaEditable({
  headers,
  filas,
  estados,
  onCambiar,
  onQuitar,
}: {
  headers: readonly string[];
  filas: FilaCruda[];
  estados: EstadoFilaPreview[];
  onCambiar: (rowNum: number, campo: string, valor: string) => void;
  onQuitar: (rowNum: number) => void;
}) {
  return (
    <div className="max-h-[28rem] overflow-auto rounded-xl border border-neutral-200">
      <table className="w-full text-xs">
        <thead className="sticky top-0 z-10">
          <tr className="text-xs">
            <th className="px-2 py-2">#</th>
            <th className="px-2 py-2">Estado</th>
            {headers.map((h) => (
              <th key={h} className="px-2 py-2">
                {h}
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
              <tr key={fila.rowNum}>
                <td className="px-2 py-1.5 tabular-nums text-neutral-500">{fila.rowNum}</td>
                <td className="min-w-[9rem] px-2 py-1.5 text-start">
                  <Chip tone={tono.tone} label={tono.label} />
                  {estado.detail && (
                    <p
                      className={`mt-1 text-[11px] leading-tight ${estado.status === "error" ? "text-red-600" : "text-amber-700"}`}
                    >
                      {estado.detail}
                    </p>
                  )}
                </td>
                {headers.map((h) => (
                  <td key={h} className="px-1 py-1.5">
                    <Input
                      value={fila.raw[h] ?? ""}
                      onChange={(e) => onCambiar(fila.rowNum, h, e.target.value)}
                      aria-label={`${h}, fila ${fila.rowNum}`}
                      className="h-8 min-w-[7.5rem] px-2 text-xs"
                    />
                  </td>
                ))}
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
  templateCsv,
  templateFilename,
  parseRow,
  marcarDuplicados,
  action,
  entidad,
  iaRestantes,
  onIaRestantes,
}: {
  entidad: EntidadImportacion;
  iaRestantes: number;
  onIaRestantes: (restantes: number) => void;
  titulo: string;
  descripcion: string;
  icon: ComponentType<{ className?: string }>;
  headers: readonly string[];
  templateCsv: () => string;
  templateFilename: string;
  parseRow: (raw: Record<string, string>, rowNum: number) => ParseResult<T>;
  marcarDuplicados: (validos: { rowNum: number; data: T }[]) => Map<number, string>;
  action: (rows: FilaCruda[]) => Promise<ImportResult>;
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
  const [avisoSheets, setAvisoSheets] = useState(false);
  const volverAlOnboarding = useVolverAlOnboarding();

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
      filasRaw.map((raw, i) => ({
        rowNum: i + 1,
        raw: Object.fromEntries(headers.map((h) => [h, raw[h] ?? ""])),
      })),
    );
    setOrigen(desde);
    setEstado("preview");
  }

  function cambiarCelda(rowNum: number, campo: string, valor: string) {
    setFilas((prev) =>
      prev.map((f) => (f.rowNum === rowNum ? { ...f, raw: { ...f.raw, [campo]: valor } } : f)),
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

  /** Sin Drive: copia la plantilla como TSV (Sheets la pega en columnas) y abre
   * una planilla nueva en la cuenta de Google del usuario. `window.open` va
   * primero, sincrónico con el click, para que no lo bloquee el navegador. */
  function abrirEnSheets() {
    window.open("https://sheets.new", "_blank", "noopener");
    const csv = Papa.parse<string[]>(templateCsv(), { skipEmptyLines: true });
    navigator.clipboard
      .writeText(Papa.unparse(csv.data, { delimiter: "\t" }))
      .then(() => setAvisoSheets(true))
      .catch(() => setErrorArchivo("No se pudo copiar la plantilla. Descargá el CSV y abrilo en Google Sheets."));
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
            <Button
              variant="outline"
              size="sm"
              icon={Download}
              onClick={() => descargar(templateCsv(), templateFilename)}
            >
              CSV
            </Button>
          </div>
        </div>

        {avisoSheets && (
          <p className="rounded-lg bg-accent-soft px-3 py-2 text-[13px] text-neutral-700">
            Copiamos la plantilla. En la planilla nueva tocá la celda A1 y pegá con{" "}
            <strong>Ctrl+V</strong>. Cuando la completes, bajala con Archivo → Descargar → CSV y
            subila acá.
          </p>
        )}

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
                  <span className="text-xs text-neutral-500">1 lectura disponible</span>
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
              filas={filas}
              estados={estados}
              onCambiar={cambiarCelda}
              onQuitar={quitarFila}
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
    </Card>
  );
}

export function ImportarDatos({
  iaRestantes: iaRestantesInicial,
}: {
  iaRestantes: Record<EntidadImportacion, number>;
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
        templateCsv={celularTemplateCsv}
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
        templateCsv={notebookTemplateCsv}
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
