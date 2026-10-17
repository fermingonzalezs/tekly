import { Section } from "@/components/section";
import { listListasDifusion } from "@/lib/db/difusion";
import { listCelulares, listOtros } from "@/lib/db/inventario";
import { listNotebooks } from "@/lib/db/notebooks";
import { DifusionClient } from "./difusion-client";

export default async function DifusionPage() {
  const [listas, celulares, notebooks, otros] = await Promise.all([
    listListasDifusion(),
    listCelulares(),
    listNotebooks(),
    listOtros(),
  ]);

  return (
    <Section title="Difusión" ayuda="difusion">
      <DifusionClient initialListas={listas} celulares={celulares} notebooks={notebooks} otros={otros} />
    </Section>
  );
}
