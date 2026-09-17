import { Section } from "@/components/section";
import { requireUser } from "@/lib/auth";
import { listCompras } from "@/lib/db/compras";
import { ComprasClient } from "./compras-client";

export default async function ComprasPage() {
  const [compras, user] = await Promise.all([listCompras(), requireUser()]);

  return (
    <Section title="Compras">
      <ComprasClient initialCompras={compras} user={user} />
    </Section>
  );
}
