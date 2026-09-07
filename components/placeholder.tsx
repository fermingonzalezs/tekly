import { Construction } from "lucide-react";
import { Card } from "@/components/ui/card";

export function Placeholder({
  title,
  note,
}: {
  title: string;
  note?: string;
}) {
  return (
    <Card className="grid place-items-center border-dashed py-20 text-center">
      <div className="max-w-sm">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-neutral-100 text-neutral-400">
          <Construction className="h-6 w-6" />
        </div>
        <p className="mt-4 text-base font-semibold">{title}</p>
        <p className="mt-1 text-sm text-neutral-400">
          {note ?? "Sección placeholder — navegación lista, contenido en la próxima iteración."}
        </p>
      </div>
    </Card>
  );
}
