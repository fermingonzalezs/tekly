import { Topbar } from "@/components/topbar";

export function Section({
  title: _title,
  children,
  mainClassName = "p-4 md:p-8",
  toolbar,
}: {
  /** Ya no se muestra en la Topbar; se mantiene por compatibilidad. */
  title: string;
  children: React.ReactNode;
  /** Reemplaza las clases del <main>. Default `p-4 md:p-8` (el `p-8` fijo
   *  dejaba mucho aire arriba/a los costados en mobile). El dashboard pasa
   *  el suyo propio para fijar el alto a la ventana y compactar el padding. */
  mainClassName?: string;
  /** Control opcional que se muestra en la Topbar (ej. selector de período). */
  toolbar?: React.ReactNode;
}) {
  return (
    <>
      <Topbar toolbar={toolbar} />
      <main className={mainClassName}>{children}</main>
    </>
  );
}
