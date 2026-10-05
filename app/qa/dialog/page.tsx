import { notFound } from "next/navigation";
import { DialogGlassDemo } from "./demo";

export const metadata = { title: "QA · Modal de vidrio" };

/** Galería de QA (solo desarrollo): el modal de vidrio ("Nuevo movimiento" de
 * Cajas) abierto sobre una maqueta, para revisarlo sin sesión. */
export default function QaDialogPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DialogGlassDemo />;
}
