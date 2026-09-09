import { Topbar } from "@/components/topbar";

export function Section({
  title,
  children,
  mainClassName = "p-8",
}: {
  title: string;
  children: React.ReactNode;
  /** Reemplaza las clases del <main>. Default `p-8`. El dashboard lo usa para
   *  fijar el alto a la ventana y compactar el padding. */
  mainClassName?: string;
}) {
  return (
    <>
      <Topbar title={title} />
      <main className={mainClassName}>{children}</main>
    </>
  );
}
