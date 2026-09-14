import { Section } from "@/components/section";
import { listCompras } from "@/lib/db/compras";
import { ComprasClient } from "./compras-client";

export default async function ComprasPage() {
  const compras = await listCompras();

  return (
    <Section title="Compras">
      <ComprasClient initialCompras={compras} />
    </Section>
  );
}
