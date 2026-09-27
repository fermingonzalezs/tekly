import { AlertCircle } from "lucide-react";

/** Bloque de error de las pantallas de auth -- alerta con ícono y fondo en
 * vez de un <p> suelto. Devuelve null si no hay mensaje, mismo patrón que
 * los helpers de components/recibos/recibo.tsx. */
export function AuthError({ message }: { message: string | null | undefined }) {
  if (!message) return null;

  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
      <p className="text-sm text-red-600">{message}</p>
    </div>
  );
}
