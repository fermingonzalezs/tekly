import { Section } from "@/components/section";
import { listListasDifusion } from "@/lib/db/difusion";
import { listEquipos, listOtros } from "@/lib/db/inventario";
import { DifusionClient } from "./difusion-client";

export default async function DifusionPage() {
  const [listas, equipos, otros] = await Promise.all([
    listListasDifusion(),
    listEquipos(),
    listOtros(),
  ]);

  return (
    <Section title="Difusión">
      <DifusionClient initialListas={listas} equipos={equipos} otros={otros} />
    </Section>
  );
}
