"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { CHART_ACCENT, CHART_COLORS } from "@/lib/chart";
import {
  DIAS_RIESGO,
  MIN_OPS_RECURRENTE,
  type FlujoClientes,
  type MixTipo,
  type OpTipo,
} from "@/lib/clientes-inteligencia";
import { TooltipBox } from "./tooltip";

// Colores por canal de cada etapa: compra = tono más oscuro, reparación el
// más claro, y "mixto" (compró Y reparó) el tono medio -- literalmente el
// punto medio de los dos mundos.
const COLOR_COMPRA = CHART_COLORS[0];
const COLOR_REPARACION = CHART_COLORS[4];
const COLOR_MIXTO = CHART_ACCENT;
// Inactivos: gris frío, no un color de serie (es un estado, no un canal).
const GRIS_INACTIVO = ["#d4d4d8", "#b6b6bf", "#9d9da8"];

// Etiquetas por tipo de operación (`OpTipo` del lib: "venta" | "ticket").
const ETAPA_LABEL: Record<OpTipo, string> = {
  venta: "compra",
  ticket: "reparación",
};
const MIX_LABEL: Record<MixTipo, string> = {
  soloCompras: "solo compras",
  soloReparaciones: "solo reparaciones",
  mixtos: "mixtos",
};

// geometría en unidades 0..100 (SVG viewBox 100x100 estirado + overlay HTML)
const STAGE_TOP = 12;
const STAGE_H = 44; // y 12..56
const CX = [20, 50, 80];
const NW = 8; // ancho de nodo (cx ± NW/2)
const BAR_X0 = 12;
const BAR_W = 76; // barra de inactivos: x 12..88
const BAR_TOP = 84;
const BAR_H = 7;
const MIN_SEG = 1.6; // alto mínimo de un segmento con datos (visibilidad)

type Seg = {
  key: string;
  label: string;
  count: number;
  color: string;
  yTop: number;
  h: number;
};

type HoverTip = { title: string; rows: [string, string][]; x: number; y: number };

/** Apila los segmentos de un nodo desde STAGE_TOP, con altos proporcionales
 *  al total de la PRIMERA etapa (los nodos se achican a medida que cae la
 *  población -- lectura de embudo, no de columnas independientes). */
function apilar(
  items: { key: string; label: string; count: number; color: string }[],
  totalPrimera: number,
): { segs: Seg[]; bottom: number } {
  let y = STAGE_TOP;
  const segs: Seg[] = [];
  for (const it of items) {
    if (it.count <= 0) continue;
    const h = Math.max(MIN_SEG, (it.count / Math.max(1, totalPrimera)) * STAGE_H);
    segs.push({ ...it, yTop: y, h });
    y += h;
  }
  return { segs, bottom: y };
}

/** Reparte el alto de un segmento entre los flujos que lo tocan,
 *  proporcional a sus clientes. `total` permite que las pistas de SALIDA
 *  cubran solo la fracción que siguió (la que quedó abajo es la que no
 *  avanzó) -- en las de ENTRADA `total` = la suma de flujos, cubre todo. */
function repartir(seg: Seg, pesos: { key: string; clientes: number }[], total: number) {
  let y = seg.yTop;
  const escala = seg.h / Math.max(1, total);
  return pesos.map((p) => {
    const h = p.clientes * escala;
    const lane = { key: p.key, yTop: y, h };
    y += h;
    return lane;
  });
}

/** El recorrido de los clientes por etapas (Sankey): 1ª operación (por tipo)
 *  → 2ª operación (por tipo -- el cruce muestra el cross-sell real
 *  reparación→compra) → recurrentes (por mix final), con los que se cayeron
 *  en cada etapa cayendo a la barra de inactivos. Los que no volvieron pero
 *  siguen dentro de la ventana de riesgo no se pierden: quedan en la nota
 *  al pie (pueden volver -- no son "inactivos" todavía). */
export function LifecycleSankey({ flujo }: { flujo: FlujoClientes }) {
  const [hover, setHover] = useState<HoverTip | null>(null);
  const [hoverRibbon, setHoverRibbon] = useState<string | null>(null);

  const totalPrimera = flujo.conOperaciones;
  const nodo1 = apilar(
    [
      { key: "venta", label: ETAPA_LABEL.venta, count: flujo.primera.compra, color: COLOR_COMPRA },
      { key: "ticket", label: ETAPA_LABEL.ticket, count: flujo.primera.reparacion, color: COLOR_REPARACION },
    ],
    totalPrimera,
  );
  const nodo2 = apilar(
    [
      { key: "venta", label: ETAPA_LABEL.venta, count: flujo.segunda.compra, color: COLOR_COMPRA },
      { key: "ticket", label: ETAPA_LABEL.ticket, count: flujo.segunda.reparacion, color: COLOR_REPARACION },
    ],
    totalPrimera,
  );
  const nodo3 = apilar(
    [
      { key: "soloCompras", label: MIX_LABEL.soloCompras, count: flujo.recurrentes.soloCompras, color: COLOR_COMPRA },
      { key: "soloReparaciones", label: MIX_LABEL.soloReparaciones, count: flujo.recurrentes.soloReparaciones, color: COLOR_REPARACION },
      { key: "mixtos", label: MIX_LABEL.mixtos, count: flujo.recurrentes.mixtos, color: COLOR_MIXTO },
    ],
    totalPrimera,
  );

  const segDe = (segs: Seg[], key: string) => segs.find((s) => s.key === key);
  const totalSeg = (segs: Seg[], key: string) => segDe(segs, key)?.count ?? 0;

  // pistas: salida del nodo k (cubre la fracción que siguió, desde arriba del
  // segmento) y entrada del nodo k+1 (cubre todo el segmento)
  type Lane = { key: string; yTop: number; h: number };
  const salidas1 = new Map<string, Lane[]>();
  const entradas2 = new Map<string, Lane[]>();
  const salidas2 = new Map<string, Lane[]>();
  const entradas3 = new Map<string, Lane[]>();

  for (const seg of nodo1.segs) {
    const flujos = flujo.flujosPrimera.filter((f) => f.de === seg.key);
    salidas1.set(
      seg.key,
      repartir(
        seg,
        flujos.map((f) => ({ key: f.a, clientes: f.clientes })),
        seg.count, // fracción que siguió
      ),
    );
  }
  for (const seg of nodo2.segs) {
    const inbound = flujo.flujosPrimera.filter((f) => f.a === seg.key);
    entradas2.set(
      seg.key,
      repartir(
        seg,
        inbound.map((f) => ({ key: f.de, clientes: f.clientes })),
        inbound.reduce((a, f) => a + f.clientes, 0),
      ),
    );
    const outbound = flujo.flujosSegunda.filter((f) => f.de === seg.key);
    salidas2.set(
      seg.key,
      repartir(
        seg,
        outbound.map((f) => ({ key: f.a, clientes: f.clientes })),
        seg.count,
      ),
    );
  }
  for (const seg of nodo3.segs) {
    const inbound = flujo.flujosSegunda.filter((f) => f.a === seg.key);
    entradas3.set(
      seg.key,
      repartir(
        seg,
        inbound.map((f) => ({ key: f.de, clientes: f.clientes })),
        inbound.reduce((a, f) => a + f.clientes, 0),
      ),
    );
  }

  const xR = (k: number) => CX[k] + NW / 2; // borde derecho del nodo k
  const xL = (k: number) => CX[k] - NW / 2; // borde izquierdo del nodo k

  const ribbon = (x1: number, y1a: number, y1b: number, x2: number, y2a: number, y2b: number) => {
    const dx = (x2 - x1) * 0.45;
    return [
      `M ${x1} ${y1a}`,
      `C ${x1 + dx} ${y1a}, ${x2 - dx} ${y2a}, ${x2} ${y2a}`,
      `L ${x2} ${y2b}`,
      `C ${x2 - dx} ${y2b}, ${x1 + dx} ${y1b}, ${x1} ${y1b}`,
      "Z",
    ].join(" ");
  };

  // flujos 1→2 y 2→3 con sus geometrías, para el SVG y el hover
  const flujosGeo: {
    id: string;
    d: string;
    color: string;
    tip: HoverTip;
  }[] = [];
  for (const f of flujo.flujosPrimera) {
    const src = segDe(nodo1.segs, f.de);
    const out = salidas1.get(f.de)?.find((l) => l.key === f.a);
    const dst = segDe(nodo2.segs, f.a);
    const inn = entradas2.get(f.a)?.find((l) => l.key === f.de);
    if (!src || !out || !dst || !inn) continue;
    flujosGeo.push({
      id: `f1-${f.de}-${f.a}`,
      d: ribbon(
        xR(0), out.yTop, out.yTop + out.h,
        xL(1), inn.yTop, inn.yTop + inn.h,
      ),
      color: src.color,
      tip: {
        title: `1ª ${ETAPA_LABEL[f.de as OpTipo]} → 2ª ${ETAPA_LABEL[f.a as OpTipo]}`,
        rows: [
          ["Clientes", String(f.clientes)],
          [
            `De 1ª ${ETAPA_LABEL[f.de as OpTipo]}`,
            `${Math.round((f.clientes / Math.max(1, src.count)) * 100)}%`,
          ],
          [
            `De 2ª ${ETAPA_LABEL[f.a as OpTipo]}`,
            `${Math.round((f.clientes / Math.max(1, dst.count)) * 100)}%`,
          ],
        ],
        x: (xR(0) + xL(1)) / 2,
        y: (out.yTop + inn.yTop + out.h + inn.h) / 2 - 2,
      },
    });
  }
  for (const f of flujo.flujosSegunda) {
    const src = segDe(nodo2.segs, f.de);
    const out = salidas2.get(f.de)?.find((l) => l.key === f.a);
    const dst = segDe(nodo3.segs, f.a);
    const inn = entradas3.get(f.a)?.find((l) => l.key === f.de);
    if (!src || !out || !dst || !inn) continue;
    flujosGeo.push({
      id: `f2-${f.de}-${f.a}`,
      d: ribbon(
        xR(1), out.yTop, out.yTop + out.h,
        xL(2), inn.yTop, inn.yTop + inn.h,
      ),
      color: src.color,
      tip: {
        title: `2ª ${ETAPA_LABEL[f.de as OpTipo]} → recurrente ${MIX_LABEL[f.a as MixTipo]}`,
        rows: [
          ["Clientes", String(f.clientes)],
          [
            `De 2ª ${ETAPA_LABEL[f.de as OpTipo]}`,
            `${Math.round((f.clientes / Math.max(1, src.count)) * 100)}%`,
          ],
          [
            `De recurrentes ${MIX_LABEL[f.a as MixTipo]}`,
            `${Math.round((f.clientes / Math.max(1, dst.count)) * 100)}%`,
          ],
        ],
        x: (xR(1) + xL(2)) / 2,
        y: (out.yTop + inn.yTop + out.h + inn.h) / 2 - 2,
      },
    });
  }

  // barra de inactivos y sus caídas (una por etapa, desde el pie del nodo)
  const totalInactivos = flujo.inactivos.reduce((a, i) => a + i.clientes, 0);
  const etapasNodo = [nodo1, nodo2, nodo3] as const;
  const inactivosSegs: { etapa: string; label: string; clientes: number; x0: number; w: number }[] = [];
  let barX = BAR_X0;
  const caidas: { id: string; d: string; xNode: number; yNode: number; w: number; tip: HoverTip }[] = [];
  if (totalInactivos > 0) {
    const ETAPA_TITULO = ["1ª operación", "2ª operación", "3+ operaciones"];
    flujo.inactivos.forEach((ino, k) => {
      if (ino.clientes <= 0) return; // nadie cayó desde esta etapa
      const w = (ino.clientes / totalInactivos) * BAR_W;
      inactivosSegs.push({
        etapa: ino.etapa,
        label: `${k + 1} ${k === 0 ? "op" : "ops"}`,
        clientes: ino.clientes,
        x0: barX,
        w,
      });
      const nodo = etapasNodo[k];
      const wNode = Math.min(26, Math.max(2, w));
      const xNode = CX[k] - wNode / 2;
      caidas.push({
        id: `drop-${ino.etapa}`,
        d: [
          `M ${xNode} ${nodo.bottom}`,
          `C ${xNode} ${nodo.bottom + 8}, ${barX} 70, ${barX} ${BAR_TOP}`,
          `L ${barX + w} ${BAR_TOP}`,
          `C ${barX + w} 70, ${xNode + wNode} ${nodo.bottom + 8}, ${xNode + wNode} ${nodo.bottom}`,
          "Z",
        ].join(" "),
        xNode,
        yNode: nodo.bottom,
        w: wNode,
        tip: {
          title: `Inactivos tras la ${ETAPA_TITULO[k]}`,
          rows: [
            ["Clientes", String(ino.clientes)],
            [`Sin actividad`, `más de ${DIAS_RIESGO} días`],
          ],
          x: (CX[k] + barX + w / 2) / 2,
          y: (nodo.bottom + BAR_TOP) / 2,
        },
      });
      barX += w;
    });
  }

  const dimRibbon = hoverRibbon !== null;

  return (
    <Card className="p-5">
      <ChartTitle
        align="left"
        divider
        sub={`el cruce 1ª→2ª operación es el cross-sell real · recurrentes = ${MIN_OPS_RECURRENTE}+ operaciones`}
      >
        Customer lifecycle
      </ChartTitle>
      {totalPrimera === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
          Sin clientes con operaciones todavía -- no hay recorrido que mostrar.
        </p>
      ) : (
        <div className="mt-3 border-t border-neutral-100 pt-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-neutral-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: COLOR_COMPRA }} />
              compra
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: COLOR_REPARACION }} />
              reparación
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: COLOR_MIXTO }} />
              mixto (compró y reparó)
            </span>
          </div>

          <div className="relative mt-2 h-[360px]">
            {/* headers de columna */}
            {["1ª operación", "2ª operación", `Recurrentes (${MIN_OPS_RECURRENTE}+)`].map((t, k) => {
              const total =
                k === 0
                  ? flujo.primera.compra + flujo.primera.reparacion
                  : k === 1
                    ? flujo.segunda.compra + flujo.segunda.reparacion
                    : flujo.recurrentes.soloCompras +
                      flujo.recurrentes.soloReparaciones +
                      flujo.recurrentes.mixtos;
              return (
                <div
                  key={t}
                  className="absolute w-28 -translate-x-1/2 text-center"
                  style={{ left: `${CX[k]}%`, top: 0 }}
                >
                  <p className="truncate text-[11px] font-medium text-neutral-500">{t}</p>
                  <p className="font-grotesk text-sm font-semibold tabular-nums text-neutral-900">
                    {total}
                    <span className="ml-1 text-[10px] font-medium text-neutral-400">
                      {Math.round((total / totalPrimera) * 100)}%
                    </span>
                  </p>
                </div>
              );
            })}

            {/* ribbons de continuación (SVG) */}
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {flujosGeo.map((f) => (
                <path
                  key={f.id}
                  d={f.d}
                  fill={f.color}
                  opacity={
                    hoverRibbon === f.id ? 0.55 : dimRibbon ? 0.07 : 0.28
                  }
                />
              ))}
              {caidas.map((c) => (
                <path key={c.id} d={c.d} fill={GRIS_INACTIVO[1]} opacity={dimRibbon ? 0.05 : 0.22} />
              ))}
            </svg>

            {/* áreas de hover de los ribbons (encima del SVG) */}
            {flujosGeo.map((f) => (
              <div
                key={`h-${f.id}`}
                onMouseEnter={() => {
                  setHoverRibbon(f.id);
                  setHover(f.tip);
                }}
                onMouseLeave={() => {
                  setHoverRibbon(null);
                  setHover(null);
                }}
                className="absolute cursor-default"
                style={{
                  left: `${f.tip.x - 7}%`,
                  top: `${Math.max(STAGE_TOP, f.tip.y - 6)}%`,
                  width: "14%",
                  height: "12%",
                }}
              />
            ))}

            {/* nodos: segmentos apilados */}
            {[nodo1, nodo2, nodo3].map((nodo, k) =>
              nodo.segs.map((seg, i) => {
                const textoBlanco = seg.color !== COLOR_REPARACION;
                return (
                  <div
                    key={`${k}-${seg.key}`}
                    onMouseEnter={() =>
                      setHover({
                        title:
                          k === 0
                            ? `1ª ${seg.label}`
                            : k === 1
                              ? `2ª ${seg.label}`
                              : `Recurrentes ${seg.label}`,
                        rows: [
                          ["Clientes", String(seg.count)],
                          [
                            "Del total con operaciones",
                            `${Math.round((seg.count / totalPrimera) * 100)}%`,
                          ],
                        ],
                        x: CX[k],
                        y: seg.yTop,
                      })
                    }
                    onMouseLeave={() => setHover(null)}
                    className={`absolute cursor-default ${i === 0 ? "rounded-t-[6px]" : ""} ${i === nodo.segs.length - 1 ? "rounded-b-[6px]" : ""}`}
                    style={{
                      left: `${xL(k)}%`,
                      top: `${seg.yTop}%`,
                      width: `${NW}%`,
                      height: `${seg.h}%`,
                      background: seg.color,
                    }}
                  >
                    {seg.h >= 6 && (
                      <p
                        className={`pt-0.5 text-center text-[10px] font-semibold tabular-nums ${textoBlanco ? "text-white" : "text-neutral-800"}`}
                      >
                        {seg.count}
                      </p>
                    )}
                  </div>
                );
              }),
            )}

            {/* barra de inactivos */}
            {totalInactivos > 0 && (
              <>
                {inactivosSegs.map((s, i) => (
                  <div
                    key={s.etapa}
                    onMouseEnter={() =>
                      setHover({
                        title: `Inactivos con ${s.label} de actividad`,
                        rows: [
                          ["Clientes", String(s.clientes)],
                          ["Sin volver", `hace más de ${DIAS_RIESGO} días`],
                        ],
                        x: s.x0 + s.w / 2,
                        y: BAR_TOP,
                      })
                    }
                    onMouseLeave={() => setHover(null)}
                    className={`absolute cursor-default ${i === 0 ? "rounded-l-md" : ""} ${i === inactivosSegs.length - 1 ? "rounded-r-md" : ""}`}
                    style={{
                      left: `${s.x0}%`,
                      top: `${BAR_TOP}%`,
                      width: `${s.w}%`,
                      height: `${BAR_H}%`,
                      background: GRIS_INACTIVO[2],
                    }}
                  >
                    {s.w >= 7 && (
                      <p className="text-center text-[10px] font-semibold tabular-nums text-neutral-700">
                        {s.clientes}
                      </p>
                    )}
                  </div>
                ))}
                <p className="absolute text-left text-[10px] font-medium uppercase tracking-wide text-neutral-400" style={{ left: 0, top: `${BAR_TOP + 1.5}%` }}>
                  inactivos
                </p>
                <p className="absolute text-right text-[10px] tabular-nums text-neutral-400" style={{ right: 0, top: `${BAR_TOP + 1.5}%` }}>
                  {totalInactivos}
                </p>
              </>
            )}

            {hover && (
              <TooltipBox
                title={hover.title}
                rows={hover.rows}
                style={{
                  left: hover.x > 62 ? undefined : `calc(${hover.x}% + 10px)`,
                  right: hover.x > 62 ? `calc(${100 - hover.x}% + 10px)` : undefined,
                  top: hover.y > 55 ? undefined : `calc(${hover.y}% - 6px)`,
                  bottom: hover.y > 55 ? `calc(${100 - hover.y}% + 6px)` : undefined,
                }}
              />
            )}
          </div>

          <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">
            Inactivos: sin actividad hace más de {DIAS_RIESGO} días
            {totalInactivos === 0 && " -- nadie superó la ventana todavía"}
            {flujo.enCurso > 0 &&
              ` · ${flujo.enCurso} no volvieron pero siguen dentro de la ventana (pueden volver)`}
          </p>
        </div>
      )}
    </Card>
  );
}
