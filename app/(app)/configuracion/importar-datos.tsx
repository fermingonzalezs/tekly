"use client";

import { useState, useTransition } from "react";
import Papa from "papaparse";
import { Card } from "@/components/ui/card";
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
  type ClienteImportInput,
  type ParseResult,
} from "@/lib/importacion";
import type { EquipoInput } from "@/lib/db/inventario";
import { importClientesAction, importEquiposAction, type ImportResult } from "./actions";

type FilaCruda = { rowNum: number; raw: Record<string, string> };
type PreviewRow = {
  rowNum: number;
  status: "ok" | "error" | "duplicate";
  detail?: string;
};

const pillOutline =
  "flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50";
const pillAccent =
  "flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:pointer-events-none disabled:opacity-50";

function descargar(contenido: string, filename: string) {
  const blob = new Blob([contenido], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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

/** Tarjeta de import genérica -- comparte el flujo elegir archivo → preview
 * (parseo + dedupe client-side, feedback instantáneo) → confirmar (la
 * Server Action revalida todo de nuevo) → resultado, para equipos y
 * clientes. Cada instancia sólo aporta el schema/dedupe/action de su
 * dominio (`lib/importacion.ts`). */
function ImportCard<T>({
  titulo,
  headers,
  templateCsv,
  templateFilename,
  parseRow,
  marcarDuplicados,
  action,
}: {
  titulo: string;
  headers: readonly string[];
  templateCsv: () => string;
  templateFilename: string;
  parseRow: (raw: Record<string, string>, rowNum: number) => ParseResult<T>;
  marcarDuplicados: (validos: { rowNum: number; data: T }[]) => Map<number, string>;
  action: (rows: FilaCruda[]) => Promise<ImportResult>;
}) {
  const [estado, setEstado] = useState<"idle" | "preview" | "done">("idle");
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [filasCrudas, setFilasCrudas] = useState<FilaCruda[]>([]);
  const [resultado, setResultado] = useState<ImportResult | null>(null);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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

    const crudas: FilaCruda[] = remap.filas.map((raw, i) => ({ rowNum: i + 1, raw }));
    const validos: { rowNum: number; data: T }[] = [];
    const filas: PreviewRow[] = [];
    for (const { rowNum, raw } of crudas) {
      const parsed = parseRow(raw, rowNum);
      if (!parsed.ok) {
        filas.push({ rowNum, status: "error", detail: parsed.error });
        continue;
      }
      validos.push({ rowNum, data: parsed.data });
    }
    const duplicadas = marcarDuplicados(validos);
    for (const v of validos) {
      const detail = duplicadas.get(v.rowNum);
      filas.push(detail ? { rowNum: v.rowNum, status: "duplicate", detail } : { rowNum: v.rowNum, status: "ok" });
    }
    filas.sort((a, b) => a.rowNum - b.rowNum);

    setPreview(filas);
    setFilasCrudas(crudas);
    setEstado("preview");
  }

  function confirmar() {
    startTransition(async () => {
      const res = await action(filasCrudas);
      setResultado(res);
      setEstado("done");
    });
  }

  function reiniciar() {
    setEstado("idle");
    setPreview([]);
    setFilasCrudas([]);
    setResultado(null);
    setErrorArchivo(null);
  }

  const validas = preview.filter((f) => f.status === "ok").length;
  const conError = preview.filter((f) => f.status === "error").length;
  const duplicadas = preview.filter((f) => f.status === "duplicate").length;

  return (
    <Card className="p-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{titulo}</p>
          <button
            onClick={() => descargar(templateCsv(), templateFilename)}
            className="text-xs font-medium text-accent hover:underline"
          >
            Descargar plantilla
          </button>
        </div>

        {estado === "idle" && (
          <div className="space-y-2">
            <input
              type="file"
              accept=".csv"
              onChange={onFile}
              className="block w-full text-sm text-neutral-600"
            />
            {errorArchivo && <p className="text-xs text-red-600">{errorArchivo}</p>}
          </div>
        )}

        {estado === "preview" && (
          <div className="space-y-3">
            <p className="text-xs text-neutral-500">
              {validas} válidas · {duplicadas} duplicadas en el archivo · {conError} con error
            </p>
            <ResultadoLista rows={preview} />
            <div className="flex gap-2">
              <button onClick={reiniciar} className={pillOutline}>
                Cancelar
              </button>
              <button onClick={confirmar} disabled={validas === 0 || pending} className={pillAccent}>
                {pending ? "Importando…" : `Confirmar importación (${validas})`}
              </button>
            </div>
          </div>
        )}

        {estado === "done" && resultado && (
          <div className="space-y-3">
            <p className="text-sm">
              <span className="font-semibold text-emerald-600">{resultado.inserted} importados</span>
              {" · "}
              <span className="text-amber-600">{resultado.skipped} omitidos (duplicados)</span>
              {" · "}
              <span className="text-red-600">{resultado.errors} con error</span>
            </p>
            <ResultadoLista rows={resultado.rows} />
            <button onClick={reiniciar} className={pillOutline}>
              Importar otro archivo
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}

export function ImportarDatos() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ImportCard<EquipoInput>
        titulo="Importar equipos"
        headers={EQUIPO_CSV_HEADERS}
        templateCsv={equipoTemplateCsv}
        templateFilename="plantilla-equipos.csv"
        parseRow={parseEquipoRow}
        marcarDuplicados={(validos) =>
          marcarImeiDuplicadoEnArchivo(validos.map((v) => ({ rowNum: v.rowNum, imei: v.data.imei })))
        }
        action={importEquiposAction}
      />
      <ImportCard<ClienteImportInput>
        titulo="Importar clientes"
        headers={CLIENTE_CSV_HEADERS}
        templateCsv={clienteTemplateCsv}
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
