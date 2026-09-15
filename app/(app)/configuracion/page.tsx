import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { listMiembros, getNegocio } from "@/lib/db/configuracion";
import { ConfiguracionClient } from "./configuracion-client";

export default async function ConfiguracionPage() {
  const user = await requireUser();

  if (user.rol !== "admin") {
    return (
      <Suspense>
        <ConfiguracionClient user={user} miembros={[]} negocio={null} />
      </Suspense>
    );
  }

  const [miembros, negocio] = await Promise.all([listMiembros(), getNegocio()]);

  return (
    <Suspense>
      <ConfiguracionClient user={user} miembros={miembros} negocio={negocio} />
    </Suspense>
  );
}
