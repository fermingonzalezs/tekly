"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { saveListaDifusion } from "@/lib/db/difusion";
import type { DifusionSeccion, ListaDifusion } from "@/lib/types";

export async function saveListaDifusionAction(data: {
  id: string;
  nombre: string;
  mensajeInicial: string;
  mensajeFinal: string;
  descuentoTipo: ListaDifusion["descuentoTipo"];
  descuentoValor: number;
  secciones: DifusionSeccion[];
}) {
  await requireUser();
  const lista = await saveListaDifusion(data.id, data);
  revalidatePath("/difusion");
  return lista;
}
