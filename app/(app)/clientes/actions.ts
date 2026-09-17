"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireRole } from "@/lib/auth";
import { createCliente, updateCliente, deleteCliente, clienteHistorial } from "@/lib/db/clientes";
import type { Cliente } from "@/lib/types";

export async function createClienteAction(data: {
  nombre: string;
  telefono?: string;
  email?: string;
  fechaNacimiento?: string;
}): Promise<Cliente> {
  await requireUser();
  const cliente = await createCliente(data);
  revalidatePath("/clientes");
  return cliente;
}

export async function updateClienteAction(
  id: string,
  data: {
    nombre: string;
    telefono?: string;
    email?: string;
    fechaNacimiento?: string;
  },
): Promise<Cliente> {
  await requireUser();
  const cliente = await updateCliente(id, data);
  revalidatePath("/clientes");
  return cliente;
}

export async function deleteClienteAction(id: string) {
  await requireRole("admin");
  await deleteCliente(id);
  revalidatePath("/clientes");
}

export async function getClienteHistorialAction(clienteId: string) {
  await requireUser();
  return clienteHistorial(clienteId);
}
