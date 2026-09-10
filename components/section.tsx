import { Topbar } from "@/components/topbar";

export function Section({
  title: _title,
  children,
  mainClassName = "p-8",
  toolbar,
}: {
  /** Ya no se muestra en la Topbar; se mantiene por compatibilidad. */
  title: string;
  children: React.ReactNode;
  /** Reemplaza las clases del <main>. Default `p-8`. El dashboard lo usa para
   *  fijar el alto a la ventana y compactar el padding. */
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
