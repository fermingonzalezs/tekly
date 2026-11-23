import { notFound } from "next/navigation";
import { Section } from "@/components/section";
import { requireRole } from "@/lib/auth";
import { getNegocio } from "@/lib/db/configuracion";
import { getResumen } from "@/lib/db/resumenes";
import { esPeriodo } from "@/lib/resumen-mensual";
import { ResumenDetalle } from "./resumen-detalle";

export default async function ResumenPage(props: { params: Promise<{ periodo: string }> }) {
  const { periodo } = await props.params;
  await requireRole("admin");
  if (!esPeriodo(periodo)) notFound();
  const [guardado, negocio] = await Promise.all([getResumen(periodo), getNegocio()]);
  if (!guardado) notFound();
  return (
    <Section title="Resumen mensual" ayuda="resumenes">
      <ResumenDetalle
        resumen={guardado.resumen}
        origen={guardado.origen}
        generadoAt={guardado.generadoAt}
        negocio={negocio}
      />
    </Section>
  );
}
