import { fmtUsd } from "@/lib/format";
import type { Equipo, OtroItem, Repuesto } from "@/lib/types";

type CampoDiff<T> = {
  key: keyof T;
  label: string;
  fmt?: (v: T[keyof T]) => string;
};

/** Compara campo por campo y arma un string tipo "precio U$500 → U$550,
 * batería 90% → 85%" con los que cambiaron. Sin cambios, dice explícito
 * "sin cambios" en vez de quedar un `detalle` vacío o engañoso. */
function diffCampos<T extends Record<string, unknown>>(
  antes: T,
  despues: T,
  campos: CampoDiff<T>[],
): string {
  const cambios = campos
    .filter((c) => antes[c.key] !== despues[c.key])
    .map((c) => {
      const fmt = c.fmt ?? ((v: T[keyof T]) => String(v));
      return `${c.label} ${fmt(antes[c.key] as T[keyof T])} → ${fmt(despues[c.key] as T[keyof T])}`;
    });
  return cambios.length ? cambios.join(", ") : "Editado (sin cambios)";
}

const CAMPOS_EQUIPO: CampoDiff<Equipo>[] = [
  { key: "modelo", label: "modelo" },
  { key: "almacenamiento", label: "almacenamiento" },
  { key: "color", label: "color" },
  { key: "imei", label: "IMEI" },
  { key: "bateria", label: "batería", fmt: (v) => `${v}%` },
  { key: "condicion", label: "condición" },
  { key: "costoUsd", label: "costo", fmt: (v) => fmtUsd(v as number) },
  { key: "precioUsd", label: "venta", fmt: (v) => fmtUsd(v as number) },
  { key: "estado", label: "estado" },
];

export function diffEquipo(antes: Equipo, despues: Equipo): string {
  return diffCampos(antes, despues, CAMPOS_EQUIPO);
}

const CAMPOS_REPUESTO: CampoDiff<Repuesto>[] = [
  { key: "sku", label: "SKU" },
  { key: "nombre", label: "nombre" },
  { key: "modelo", label: "modelo" },
  { key: "stock", label: "stock" },
  { key: "stockMin", label: "stock mínimo" },
  { key: "costoUsd", label: "costo", fmt: (v) => fmtUsd(v as number) },
  { key: "proveedor", label: "proveedor" },
];

export function diffRepuesto(antes: Repuesto, despues: Repuesto): string {
  return diffCampos(antes, despues, CAMPOS_REPUESTO);
}

/** `OtroItem` es un tipo unión (serializado/no) -- se compara a mano en vez
 * de con `diffCampos` genérico para no pelear con TS por los campos que
 * solo existen en una de las dos variantes. `cantidad`/`costoUsd` solo se
 * comparan cuando ninguno de los dos lados está serializado (las unidades
 * de un serializado no se diffean, es un caso raro y su propia lista ya
 * queda en `unidades`). */
export function diffOtro(antes: OtroItem, despues: OtroItem): string {
  const cambios: string[] = [];
  if (antes.nombre !== despues.nombre) {
    cambios.push(`nombre ${antes.nombre} → ${despues.nombre}`);
  }
  if (antes.categoria !== despues.categoria) {
    cambios.push(`categoría ${antes.categoria} → ${despues.categoria}`);
  }
  if (antes.precioUsd !== despues.precioUsd) {
    cambios.push(`venta ${fmtUsd(antes.precioUsd)} → ${fmtUsd(despues.precioUsd)}`);
  }
  if (!antes.serializado && !despues.serializado) {
    if (antes.cantidad !== despues.cantidad) {
      cambios.push(`cantidad ${antes.cantidad} → ${despues.cantidad}`);
    }
    if (antes.costoUsd !== despues.costoUsd) {
      cambios.push(`costo ${fmtUsd(antes.costoUsd)} → ${fmtUsd(despues.costoUsd)}`);
    }
  }
  return cambios.length ? cambios.join(", ") : "Editado (sin cambios)";
}
