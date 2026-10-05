import { Suspense } from "react";
import { DemoVentas } from "./demo-ventas";

export default function DemoVentasPage() {
  return (
    <Suspense fallback={null}>
      <DemoVentas />
    </Suspense>
  );
}
