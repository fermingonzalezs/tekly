import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { listMiembros, listWhatsappTemplates, getNegocio } from "@/lib/db/configuracion";
import { ConfiguracionClient } from "./configuracion-client";

export default async function ConfiguracionPage() {
  const user = await requireUser();

  if (user.rol !== "admin") {
    return (
      <Suspense>
        <ConfiguracionClient user={user} miembros={[]} templates={[]} negocio={null} />
      </Suspense>
    );
  }

  const [miembros, templates, negocio] = await Promise.all([
    listMiembros(),
    listWhatsappTemplates(),
    getNegocio(),
  ]);

  return (
    <Suspense>
      <ConfiguracionClient user={user} miembros={miembros} templates={templates} negocio={negocio} />
    </Suspense>
  );
}
