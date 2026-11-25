import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { listMiembros, getNegocio } from "@/lib/db/configuracion";
import { listVariantes } from "@/lib/db/variantes";
import { lecturasIaIlimitadas, lecturasIaUsadas } from "@/lib/db/ia-lecturas";
import { ENTIDADES_IMPORTACION, lecturasRestantes, type EntidadImportacion } from "@/lib/ia-lecturas";
import { ConfiguracionClient } from "./configuracion-client";

// La lectura con IA de "Importar datos" corre como server action de esta
// página; un texto largo puede tardar más que el límite por defecto.
export const maxDuration = 120;

const IA_SIN_CUPO: Record<EntidadImportacion, number> = { celulares: 0, notebooks: 0, clientes: 0 };

export default async function ConfiguracionPage() {
  const user = await requireUser();

  if (user.rol !== "admin") {
    return (
      <Suspense>
        <ConfiguracionClient
          user={user}
          miembros={[]}
          negocio={null}
          iaRestantes={IA_SIN_CUPO}
          variantes={[]}
        />
      </Suspense>
    );
  }

  const [miembros, negocio, lecturasIa, iaIlimitadas, variantes] = await Promise.all([
    listMiembros(),
    getNegocio(),
    lecturasIaUsadas(),
    lecturasIaIlimitadas(),
    listVariantes({ categoria: "todas" }),
  ]);

  return (
    <Suspense>
      <ConfiguracionClient
        user={user}
        miembros={miembros}
        negocio={negocio}
        variantes={variantes}
        iaRestantes={
          Object.fromEntries(
            ENTIDADES_IMPORTACION.map((e) => [e, lecturasRestantes(lecturasIa[e], iaIlimitadas)]),
          ) as Record<EntidadImportacion, number>
        }
      />
    </Suspense>
  );
}
