"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartTitle } from "@/components/ui/chart-title";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/field";
import { deleteOrganizacionPlatformAction } from "./actions";

/** Eliminar una organización entera (irreversible). Pide tipear el nombre
 * para confirmar. La propia organización del admin de plataforma no se
 * puede borrar. */
export function EliminarOrgCard({
  orgId,
  nombre,
  esPropia,
  usuarios,
}: {
  orgId: string;
  nombre: string;
  esPropia: boolean;
  usuarios: number;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function cerrar() {
    setAbierto(false);
    setTexto("");
    setError(null);
  }

  function eliminar() {
    if (texto.trim() !== nombre) {
      setError("El nombre no coincide.");
      return;
    }
    setError(null);
    start(async () => {
      const r = await deleteOrganizacionPlatformAction(orgId);
      if (r.error) {
        setError(r.error);
        return;
      }
      router.push("/admin");
      router.refresh();
    });
  }

  return (
    <Card className="border-red-200 p-5">
      <ChartTitle align="left" divider>
        Eliminar organización
      </ChartTitle>
      <p className="mb-4 text-[13px] text-neutral-600">
        Borra la organización con todos sus datos (ventas, clientes, inventario, tickets, cajas…) y
        sus {usuarios} {usuarios === 1 ? "usuario" : "usuarios"}. No se puede deshacer.
      </p>
      {esPropia ? (
        <p className="text-[13px] text-neutral-500">
          Es tu propia organización: no se puede eliminar desde acá.
        </p>
      ) : (
        <Button variant="danger-outline" onClick={() => setAbierto(true)}>
          Eliminar organización
        </Button>
      )}

      <ConfirmDialog
        key={abierto ? "eliminar-org-open" : "eliminar-org-none"}
        open={abierto}
        onClose={cerrar}
        onConfirm={eliminar}
        pending={pending}
        title="¿Eliminar organización?"
        confirmLabel="Eliminar definitivamente"
      >
        <p>
          Se eliminará «{nombre}» junto con todos sus datos y usuarios. Para confirmar, escribí el
          nombre exacto de la organización.
        </p>
        <Input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={nombre}
          aria-label="Nombre de la organización"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
      </ConfirmDialog>
    </Card>
  );
}
