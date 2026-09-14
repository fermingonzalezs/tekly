"use client";

import { useState, useTransition } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { StatCard } from "@/components/ui/stat-card";
import { otroCostoPromedio } from "@/lib/otros";
import { otroCategoria as otroCategoriaCfg } from "@/lib/status";
import { fmtUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { filterPill, thDivider } from "@/lib/ui-styles";
import type {
  DifusionEntrada,
  DifusionSeccion,
  Equipo,
  ListaDifusion,
  OtroCategoria,
  OtroItem,
} from "@/lib/types";
import { saveListaDifusionAction } from "./actions";

const rid = () => Math.random().toString(36).slice(2);

const CATEGORIAS: OtroCategoria[] = ["ipad", "airpods", "tablet", "accesorio", "otro"];

type Linea = { texto: string; precioUsd: number; costoUsd?: number };

/** Convierte una regla/ítem manual en las líneas de mensaje que aporta —
 * las reglas de equipo/otro se evalúan contra el stock actual. */
function expandirEntrada(entrada: DifusionEntrada, equipos: Equipo[], otros: OtroItem[]): Linea[] {
  if (entrada.tipo === "manual") {
    return [{ texto: entrada.texto, precioUsd: entrada.precioUsd, costoUsd: entrada.costoUsd }];
  }
  if (entrada.tipo === "equipo") {
    return equipos
      .filter((e) => e.estado === "disponible")
      .filter(
        (e) => entrada.condiciones.length === 0 || entrada.condiciones.includes(e.condicion),
      )
      .map((e) => ({
        texto: `${e.modelo} ${e.almacenamiento} ${e.color}`,
        precioUsd: e.precioUsd,
        costoUsd: e.costoUsd,
      }));
  }
  return otros
    .filter((o) => o.categoria === entrada.categoria)
    .map((o) => ({ texto: o.nombre, precioUsd: o.precioUsd, costoUsd: otroCostoPromedio(o) }));
}

/** El descuento por monto fijo se resta del precio. El de porcentaje se
 * calcula sobre la ganancia (precioUsd - costoUsd), no sobre el precio —
 * un 10% de descuento no puede significar perder el 10% del precio de
 * venta si el margen es menor a eso. Sin costo, se asume que todo el
 * precio es ganancia (ítems manuales sin dato de costo). */
function precioConDescuento(linea: Linea, lista: ListaDifusion) {
  if (lista.descuentoTipo === "monto") return Math.max(0, linea.precioUsd - lista.descuentoValor);
  if (lista.descuentoTipo === "porcentaje") {
    const ganancia = linea.precioUsd - (linea.costoUsd ?? 0);
    return Math.max(0, Math.round(linea.precioUsd - ganancia * (lista.descuentoValor / 100)));
  }
  return linea.precioUsd;
}

function totalItems(l: ListaDifusion, equipos: Equipo[], otros: OtroItem[]) {
  return l.secciones.reduce(
    (a, s) => a + s.entradas.flatMap((e) => expandirEntrada(e, equipos, otros)).length,
    0,
  );
}

function descuentoLabel(l: ListaDifusion) {
  if (l.descuentoTipo === "monto") return `-${fmtUsd(l.descuentoValor)}`;
  if (l.descuentoTipo === "porcentaje") return `-${l.descuentoValor}%`;
  return "—";
}

function buildMensaje(lista: ListaDifusion, equipos: Equipo[], otros: OtroItem[]) {
  const partes: string[] = [];
  if (lista.mensajeInicial.trim()) partes.push(lista.mensajeInicial.trim());
  for (const sec of lista.secciones) {
    const lineas = sec.entradas.flatMap((e) => expandirEntrada(e, equipos, otros));
    if (lineas.length === 0) continue;
    partes.push("");
    partes.push(sec.nombre.trim().toUpperCase() || "SIN NOMBRE");
    partes.push("");
    for (const linea of lineas) {
      partes.push(`${sec.emoji} ${linea.texto} - ${fmtUsd(precioConDescuento(linea, lista))}`);
    }
  }
  if (lista.mensajeFinal.trim()) {
    partes.push("");
    partes.push(lista.mensajeFinal.trim());
  }
  return partes.join("\n");
}

function blankLista(): ListaDifusion {
  return {
    id: "",
    nombre: "",
    mensajeInicial: "",
    mensajeFinal: "",
    descuentoTipo: "ninguno",
    descuentoValor: 0,
    secciones: [],
    creadaEl: "",
  };
}

export function DifusionClient({
  initialListas,
  equipos,
  otros,
}: {
  initialListas: ListaDifusion[];
  equipos: Equipo[];
  otros: OtroItem[];
}) {
  const [listas, setListas] = useState<ListaDifusion[]>(initialListas);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<ListaDifusion | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const condiciones = Array.from(new Set(equipos.map((e) => e.condicion))).sort();

  const filtered = listas.filter((l) =>
    l.nombre.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const viewing = listas.find((l) => l.id === viewingId) ?? null;

  const totalItemsAll = listas.reduce((a, l) => a + totalItems(l, equipos, otros), 0);
  const conDescuento = listas.filter((l) => l.descuentoTipo !== "ninguno").length;

  const save = (l: ListaDifusion) => {
    setListas((prev) =>
      prev.some((x) => x.id === l.id) ? prev.map((x) => (x.id === l.id ? l : x)) : [l, ...prev],
    );
    setEditing(null);
    setCreatingNew(false);
  };

  const copiar = async (l: ListaDifusion) => {
    try {
      await navigator.clipboard.writeText(buildMensaje(l, equipos, otros));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // sin permiso de portapapeles: no hacemos nada, el texto sigue visible en el preview.
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard align="left" label="Listas" value={listas.length} />
        <StatCard align="left" label="Ítems publicados" value={totalItemsAll} />
        <StatCard align="left" label="Con descuento activo" value={conDescuento} />
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar lista por nombre…"
            className={cn("w-64 pl-9", filterPill)}
          />
        </div>
        <button
          onClick={() => setCreatingNew(true)}
          className="ml-auto flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-accent/40 px-4 text-sm font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft"
        >
          <Plus className="h-4 w-4" />
          Nueva lista
        </button>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-xs text-neutral-400">
              <th className={cn("px-5 py-3 text-center", thDivider)}>Nombre</th>
              <th className={cn("px-5 py-3 text-center", thDivider)}>Mensaje inicial</th>
              <th className={cn("px-5 py-3 text-center", thDivider)}>Secciones</th>
              <th className={cn("px-5 py-3 text-center", thDivider)}>Ítems</th>
              <th className="px-5 py-3 text-center">Descuento</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr
                key={l.id}
                onClick={() => setViewingId(l.id)}
                className="cursor-pointer border-t border-neutral-100 first:border-t-0 hover:bg-neutral-50"
              >
                <td className="max-w-[180px] truncate px-5 py-2 text-center font-medium">
                  {l.nombre}
                </td>
                <td className="max-w-[240px] truncate px-5 py-2 text-center text-neutral-500">
                  {l.mensajeInicial || "—"}
                </td>
                <td className="px-5 py-2 text-center tabular-nums">{l.secciones.length}</td>
                <td className="px-5 py-2 text-center tabular-nums">
                  {totalItems(l, equipos, otros)}
                </td>
                <td className="px-5 py-2 text-center font-semibold tabular-nums">
                  {descuentoLabel(l)}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-neutral-400">
                  Sin listas para esta búsqueda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Dialog
        open={!!viewing}
        onClose={() => setViewingId(null)}
        size="lg"
        accent
        title={viewing?.nombre ?? ""}
        description={
          viewing ? `${viewing.secciones.length} secciones · ${totalItems(viewing, equipos, otros)} ítems` : ""
        }
        footer={
          viewing && (
            <>
              <button
                onClick={() => setViewingId(null)}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
              >
                Cerrar
              </button>
              <button
                onClick={() => {
                  setEditing(viewing);
                  setViewingId(null);
                }}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-accent/40 px-4 text-sm font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft"
              >
                Editar
              </button>
              <button
                onClick={() => copiar(viewing)}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent/90"
              >
                {copied ? "¡Copiado!" : "Copiar mensaje"}
              </button>
            </>
          )
        }
      >
        {viewing && (
          <pre className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-lg bg-neutral-50 p-4 text-[13px] leading-relaxed text-neutral-700">
            {buildMensaje(viewing, equipos, otros)}
          </pre>
        )}
      </Dialog>

      <ListaEditorDialog
        key={editing ? editing.id : creatingNew ? "new" : "closed"}
        lista={editing}
        equipos={equipos}
        otros={otros}
        condiciones={condiciones}
        open={creatingNew || !!editing}
        onClose={() => {
          setEditing(null);
          setCreatingNew(false);
        }}
        onSave={save}
      />
    </div>
  );
}

function ListaEditorDialog({
  lista,
  equipos,
  otros,
  condiciones,
  open,
  onClose,
  onSave,
}: {
  lista: ListaDifusion | null;
  equipos: Equipo[];
  otros: OtroItem[];
  condiciones: string[];
  open: boolean;
  onClose: () => void;
  onSave: (l: ListaDifusion) => void;
}) {
  const [draft, setDraft] = useState<ListaDifusion>(lista ?? blankLista());
  const [pending, startTransition] = useTransition();

  const updateSeccion = (idx: number, s: DifusionSeccion) => {
    setDraft((d) => ({ ...d, secciones: d.secciones.map((x, i) => (i === idx ? s : x)) }));
  };
  const removeSeccion = (idx: number) => {
    setDraft((d) => ({ ...d, secciones: d.secciones.filter((_, i) => i !== idx) }));
  };
  const addSeccion = () => {
    setDraft((d) => ({
      ...d,
      secciones: [...d.secciones, { id: `sec-${rid()}`, nombre: "", emoji: "📱", entradas: [] }],
    }));
  };

  const valid = !!draft.nombre.trim();

  const submit = () => {
    startTransition(async () => {
      const nombre = draft.nombre.trim();
      const guardada = await saveListaDifusionAction({
        id: lista?.id ?? "",
        nombre,
        mensajeInicial: draft.mensajeInicial,
        mensajeFinal: draft.mensajeFinal,
        descuentoTipo: draft.descuentoTipo,
        descuentoValor: draft.descuentoValor,
        secciones: draft.secciones,
      });
      onSave(guardada);
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      accent
      size="lg"
      title={lista ? "Editar lista" : "Nueva lista"}
      footer={
        <>
          <button
            onClick={onClose}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
          >
            Cancelar
          </button>
          <button
            disabled={!valid || pending}
            onClick={submit}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:pointer-events-none disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Guardar lista"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nombre">
          <Input
            value={draft.nombre}
            onChange={(e) => setDraft((d) => ({ ...d, nombre: e.target.value }))}
            placeholder="Ej. Disponibles"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Mensaje inicial">
            <Textarea
              rows={2}
              value={draft.mensajeInicial}
              onChange={(e) => setDraft((d) => ({ ...d, mensajeInicial: e.target.value }))}
              placeholder="🔥 DISPONIBLES 🔥"
            />
          </Field>
          <Field label="Mensaje final">
            <Textarea
              rows={2}
              value={draft.mensajeFinal}
              onChange={(e) => setDraft((d) => ({ ...d, mensajeFinal: e.target.value }))}
              placeholder="Consultanos por más info…"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Descuento">
            <Select
              value={draft.descuentoTipo}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  descuentoTipo: e.target.value as ListaDifusion["descuentoTipo"],
                }))
              }
            >
              <option value="ninguno">Sin descuento</option>
              <option value="monto">Monto fijo (USD)</option>
              <option value="porcentaje">Porcentaje sobre la ganancia (%)</option>
            </Select>
          </Field>
          {draft.descuentoTipo !== "ninguno" && (
            <Field label={draft.descuentoTipo === "monto" ? "Monto (USD)" : "Porcentaje (%)"}>
              <Input
                type="number"
                min={0}
                value={draft.descuentoValor || ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, descuentoValor: Number(e.target.value) }))
                }
              />
            </Field>
          )}
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            Secciones
          </p>
          <div className="space-y-3">
            {draft.secciones.map((s, idx) => (
              <SeccionEditor
                key={s.id}
                seccion={s}
                equipos={equipos}
                otros={otros}
                condiciones={condiciones}
                onChange={(ns) => updateSeccion(idx, ns)}
                onRemove={() => removeSeccion(idx)}
              />
            ))}
            {draft.secciones.length === 0 && (
              <p className="text-[13px] text-neutral-400">Sin secciones todavía.</p>
            )}
          </div>
          <button
            onClick={addSeccion}
            className="mt-2 flex items-center gap-1.5 rounded-full border border-accent/40 px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft"
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar sección
          </button>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            Vista previa
          </p>
          <pre className="max-h-52 overflow-y-auto whitespace-pre-wrap rounded-lg bg-neutral-50 p-3 text-[13px] leading-relaxed text-neutral-700">
            {buildMensaje(draft, equipos, otros) || "El mensaje va a aparecer acá a medida que lo completes."}
          </pre>
        </div>
      </div>
    </Dialog>
  );
}

function SeccionEditor({
  seccion,
  equipos,
  otros,
  condiciones,
  onChange,
  onRemove,
}: {
  seccion: DifusionSeccion;
  equipos: Equipo[];
  otros: OtroItem[];
  condiciones: string[];
  onChange: (s: DifusionSeccion) => void;
  onRemove: () => void;
}) {
  const addEntrada = (entrada: DifusionEntrada) => {
    onChange({ ...seccion, entradas: [...seccion.entradas, entrada] });
  };
  const removeEntrada = (id: string) => {
    onChange({ ...seccion, entradas: seccion.entradas.filter((e) => e.id !== id) });
  };

  return (
    <div className="rounded-xl border border-neutral-200 p-3">
      <div className="flex items-center gap-2">
        <Input
          value={seccion.emoji}
          onChange={(e) => onChange({ ...seccion, emoji: e.target.value })}
          placeholder="📱"
          className="w-14 shrink-0 text-center"
        />
        <Input
          value={seccion.nombre}
          onChange={(e) => onChange({ ...seccion, nombre: e.target.value })}
          placeholder="Ej. IPHONE USADOS"
          className="flex-1 font-semibold"
        />
        <button
          onClick={onRemove}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-500"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 space-y-1.5">
        {seccion.entradas.map((entrada) => (
          <EntradaRow
            key={entrada.id}
            entrada={entrada}
            equipos={equipos}
            otros={otros}
            onRemove={() => removeEntrada(entrada.id)}
          />
        ))}
        {seccion.entradas.length === 0 && (
          <p className="text-[13px] text-neutral-400">Sin reglas ni ítems todavía.</p>
        )}
      </div>

      <div className="mt-3 border-t border-neutral-100 pt-3">
        <AgregarEntrada condiciones={condiciones} onAdd={addEntrada} />
      </div>
    </div>
  );
}

function EntradaRow({
  entrada,
  equipos,
  otros,
  onRemove,
}: {
  entrada: DifusionEntrada;
  equipos: Equipo[];
  otros: OtroItem[];
  onRemove: () => void;
}) {
  const lineas = expandirEntrada(entrada, equipos, otros);
  const detalle =
    entrada.tipo === "equipo" ? (
      <span className="text-neutral-700">
        <span className="font-medium">Equipos</span> · condición{" "}
        {entrada.condiciones.length === 0 ? "todas" : entrada.condiciones.join(", ")}
        <span className="text-neutral-400"> — {lineas.length} coincidencia{lineas.length === 1 ? "" : "s"} actual{lineas.length === 1 ? "" : "es"}</span>
      </span>
    ) : entrada.tipo === "otro" ? (
      <span className="text-neutral-700">
        <span className="font-medium">Otros</span> · {otroCategoriaCfg[entrada.categoria].label}
        <span className="text-neutral-400"> — {lineas.length} coincidencia{lineas.length === 1 ? "" : "s"}</span>
      </span>
    ) : (
      <span className="text-neutral-700">
        {entrada.texto}
        <span className="text-neutral-400"> — {fmtUsd(entrada.precioUsd)}</span>
      </span>
    );

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-[13px]">
      <span className="min-w-0 truncate">{detalle}</span>
      <button
        onClick={onRemove}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-500"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function AgregarEntrada({
  condiciones,
  onAdd,
}: {
  condiciones: string[];
  onAdd: (entrada: DifusionEntrada) => void;
}) {
  const [tipo, setTipo] = useState<DifusionEntrada["tipo"]>("equipo");
  const [seleccionadas, setSeleccionadas] = useState<string[]>([]);
  const [categoria, setCategoria] = useState<OtroCategoria>("ipad");
  const [manualTexto, setManualTexto] = useState("");
  const [manualPrecio, setManualPrecio] = useState(0);
  const [manualCosto, setManualCosto] = useState(0);

  const toggleCondicion = (c: string) => {
    setSeleccionadas((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const add = () => {
    if (tipo === "equipo") {
      onAdd({ id: `r-${rid()}`, tipo: "equipo", condiciones: seleccionadas });
      setSeleccionadas([]);
      return;
    }
    if (tipo === "otro") {
      onAdd({ id: `r-${rid()}`, tipo: "otro", categoria });
      return;
    }
    if (!manualTexto.trim() || manualPrecio <= 0) return;
    onAdd({
      id: `m-${rid()}`,
      tipo: "manual",
      texto: manualTexto.trim(),
      precioUsd: manualPrecio,
      costoUsd: manualCosto > 0 ? manualCosto : undefined,
    });
    setManualTexto("");
    setManualPrecio(0);
    setManualCosto(0);
  };

  return (
    <div className="space-y-2">
      <Select value={tipo} onChange={(e) => setTipo(e.target.value as DifusionEntrada["tipo"])}>
        <option value="equipo">Equipos por condición</option>
        <option value="otro">Otros por categoría</option>
        <option value="manual">Ítem manual</option>
      </Select>

      {tipo === "equipo" && (
        <div className="flex flex-wrap gap-1.5">
          {condiciones.map((c) => {
            const sel = seleccionadas.includes(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggleCondicion(c)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  sel
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-neutral-200 text-neutral-500 hover:border-neutral-300",
                )}
              >
                {c}
              </button>
            );
          })}
          <span className="self-center text-[11px] text-neutral-400">
            {seleccionadas.length === 0 ? "Sin seleccionar = todas" : ""}
          </span>
        </div>
      )}

      {tipo === "otro" && (
        <Select value={categoria} onChange={(e) => setCategoria(e.target.value as OtroCategoria)}>
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {otroCategoriaCfg[c].label}
            </option>
          ))}
        </Select>
      )}

      {tipo === "manual" && (
        <div className="space-y-2">
          <Input
            value={manualTexto}
            onChange={(e) => setManualTexto(e.target.value)}
            placeholder="Ej. Funda de silicona (varios colores)"
          />
          <div className="flex gap-2">
            <Input
              type="number"
              min={0}
              value={manualPrecio || ""}
              onChange={(e) => setManualPrecio(Number(e.target.value))}
              placeholder="Precio (USD)"
              className="w-32"
            />
            <Input
              type="number"
              min={0}
              value={manualCosto || ""}
              onChange={(e) => setManualCosto(Number(e.target.value))}
              placeholder="Costo (opcional)"
              className="w-36"
            />
          </div>
        </div>
      )}

      <button
        onClick={add}
        disabled={tipo === "manual" && (!manualTexto.trim() || manualPrecio <= 0)}
        className="flex items-center gap-1.5 rounded-full border border-accent/40 px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:border-accent/70 hover:bg-accent-soft disabled:pointer-events-none disabled:opacity-40"
      >
        <Plus className="h-3.5 w-3.5" />
        Agregar
      </button>
    </div>
  );
}
