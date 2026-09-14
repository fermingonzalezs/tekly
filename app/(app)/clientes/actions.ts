"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createCliente, clienteHistorial } from "@/lib/db/clientes";
import type { Cliente } from "@/lib/types";

export async function createClienteAction(data: {
  nombre: string;
  telefono?: string;
  email?: string;
}): Promise<Cliente> {
  await requireUser();
  const cliente = await createCliente(data);
  revalidatePath("/clientes");
  return cliente;
}

export async function getClienteHistorialAction(clienteId: string) {
  await requireUser();
  return clienteHistorial(clienteId);
}
