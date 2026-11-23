import { Section } from "@/components/section";
import { requireRole } from "@/lib/auth";
import { listResumenes } from "@/lib/db/resumenes";
import { hoyISO } from "@/lib/date-presets";
import { periodoACerrar } from "@/lib/resumen-mensual";
import { ResumenesClient } from "./resumenes-client";

/** Resúmenes mensuales (plan 022): solo admin (costos, ganancia, saldos). */
export default async function ResumenesPage() {
  await requireRole("admin");
  const resumenes = await listResumenes();
  return (
    <Section title="Resúmenes" ayuda="resumenes">
      <ResumenesClient
        resumenes={resumenes}
        mesActual={hoyISO().slice(0, 7)}
        mesACerrar={periodoACerrar(new Date())}
      />
    </Section>
  );
}
