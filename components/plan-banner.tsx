import Link from "next/link";
import { Clock, Lock } from "lucide-react";
import { estadoDeAcceso, motivoSoloLectura, type Suscripcion } from "@/lib/planes";

/** Aviso fijo bajo la navegación: prueba gratis en curso (últimos 7 días) o
 * cuenta en solo lectura. Server component -- el estado se calcula en el
 * server, sin hidratación. Un plan pago al día no muestra nada. */
export function PlanBanner({
  suscripcion,
  esAdmin,
}: {
  suscripcion: Suscripcion;
  esAdmin: boolean;
}) {
  const acceso = estadoDeAcceso(suscripcion);

  if (acceso.modo === "solo_lectura") {
    return (
      <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-red-200 bg-red-50 px-5 py-2.5 text-[13px] text-red-800">
        <Lock className="h-4 w-4 shrink-0" />
        <span className="font-medium">
          {motivoSoloLectura(acceso.motivo)} Podés ver tus datos, pero no cargar ni modificar nada.
        </span>
        {esAdmin ? (
          <Link href="/plan" className="font-semibold underline underline-offset-2">
            Elegir un plan
          </Link>
        ) : (
          <span>Pedile al administrador que active un plan.</span>
        )}
      </div>
    );
  }

  if (acceso.modo === "trial" && acceso.diasRestantes <= 7) {
    return (
      <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-accent/20 bg-accent-soft px-5 py-2.5 text-[13px] text-accent">
        <Clock className="h-4 w-4 shrink-0" />
        <span className="font-medium">
          {acceso.diasRestantes === 1
            ? "Te queda 1 día de prueba gratis."
            : `Te quedan ${acceso.diasRestantes} días de prueba gratis.`}
        </span>
        {esAdmin && (
          <Link href="/plan" className="font-semibold underline underline-offset-2">
            Ver planes
          </Link>
        )}
      </div>
    );
  }

  return null;
}
