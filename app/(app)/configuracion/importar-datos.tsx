"use client";

import { useState, useTransition } from "react";
import Papa from "papaparse";
import { CheckCircle2, Download, Smartphone, Upload, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { dotClass, type Tone } from "@/lib/status";
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
import type { ComponentType } from "react";

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

/** Tarjeta de import genérica -- comparte el flujo elegir archivo → preview
 * (parseo + dedupe client-side, feedback instantáneo) → confirmar (la
 * Server Action revalida todo de nuevo) → resultado, para equipos y
 * clientes. Cada instancia sólo aporta el schema/dedupe/action de su
 * dominio (`lib/importacion.ts`). */
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
}: {
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
          <button
            onClick={() => descargar(templateCsv(), templateFilename)}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 px-3 text-xs font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
          >
            <Download className="h-3.5 w-3.5" />
            Plantilla
          </button>
        </div>

        {estado === "idle" && (
          <div className="space-y-2">
            <label className="group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50 px-4 py-8 text-center transition-colors hover:border-accent/40 hover:bg-accent-soft/40">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-accent shadow-sm ring-1 ring-neutral-200 transition-colors group-hover:ring-accent/30">
                <Upload className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-700">Elegir archivo CSV</p>
                <p className="text-xs text-neutral-400">Usá la plantilla para respetar las columnas</p>
              </div>
              <input type="file" accept=".csv" onChange={onFile} className="sr-only" />
            </label>
            {errorArchivo && <p className="text-xs text-red-600">{errorArchivo}</p>}
          </div>
        )}

        {estado === "preview" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Chip tone="green" label={`${validas} válidas`} />
              {duplicadas > 0 && <Chip tone="amber" label={`${duplicadas} duplicadas en el archivo`} />}
              {conError > 0 && <Chip tone="red" label={`${conError} con error`} />}
            </div>
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
    <div className="grid gap-6 lg:grid-cols-2">
      <ImportCard<EquipoInput>
        titulo="Importar equipos"
        descripcion="Alta masiva de equipos existentes por IMEI"
        icon={Smartphone}
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
        descripcion="Alta masiva de clientes existentes"
        icon={Users}
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
