"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { useOutsideClick } from "@/components/ui/use-outside-click";

const FILAS = [
  ["04 oct", "Venta V-4821 · Caro Díaz", "Mostrador", "+ $ 1.077.000"],
  ["04 oct", "Entrega ticket #128 · Meli", "Mostrador", "+ $ 205.000"],
  ["03 oct", "Compra C-31 · Tecno Import", "Banco", "− $ 880.000"],
  ["03 oct", "Venta V-4822 · Nico Ortega", "Banco", "+ $ 1.730.000"],
  ["02 oct", "Servicios luz y wifi", "Mostrador", "− $ 94.500"],
  ["02 oct", "Alquiler local octubre", "Banco", "− $ 650.000"],
] as const;

type Tamano = "md" | "lg" | "xl" | "2xl";

/** Demo de dropdown que sobresale del panel (mismo caso que `ClientePicker` /
 * `ItemBuscador`): tiene que quedar opaco y por encima. */
function DropdownDemo() {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClick<HTMLDivElement>(() => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <Input
        placeholder="Cliente (dropdown de prueba)"
        onFocus={() => setOpen(true)}
        onChange={() => setOpen(true)}
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-neutral-200 bg-white p-1 shadow-lg">
          {["Caro Díaz", "Nico Ortega", "Lu Fernández"].map((c) => (
            <div key={c} className="rounded-md px-3 py-2 text-[13px] hover:bg-neutral-50">
              {c}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Formulario({ largo = false }: { largo?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
      <Field label="Tipo">
        <Select defaultValue="egreso">
          <option value="ingreso">Ingreso</option>
          <option value="egreso">Egreso</option>
        </Select>
      </Field>
      <Field label="Caja">
        <Select>
          <option>Mostrador · ARS</option>
        </Select>
      </Field>
      <Field label="Concepto" className="sm:col-span-2">
        <Input defaultValue="Compra repuestos — PartsAR" />
      </Field>
      {largo && (
        <>
          <Field label="Categoría">
            <Select>
              <option>Insumos y repuestos</option>
            </Select>
          </Field>
          <Field label="Monto (ARS)">
            <Input type="number" defaultValue={72000} />
          </Field>
          <p className="text-[11px] text-neutral-500 sm:col-span-2">
            Contenido extra para forzar scroll dentro del modal.
          </p>
        </>
      )}
      <DropdownDemo />
    </div>
  );
}

export function DialogGlassDemo() {
  const [abierto, setAbierto] = useState<Tamano | null>("lg");
  const [sinFooter, setSinFooter] = useState(false);
  const [nested, setNested] = useState(false);
  const recuerdaTamano = useRef<Tamano>("lg");

  function abrir(t: Tamano) {
    recuerdaTamano.current = t;
    setAbierto(t);
  }

  return (
    <main className="min-h-screen space-y-6 p-8">
      <div className="flex flex-wrap gap-2">
        {(["md", "lg", "xl", "2xl"] as Tamano[]).map((t) => (
          <Button key={t} variant="outline" onClick={() => abrir(t)}>
            Dialog {t}
          </Button>
        ))}
        <Button
          variant="outline"
          onClick={() => {
            recuerdaTamano.current = "lg";
            setSinFooter(true);
          }}
        >
          Sin footer
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            recuerdaTamano.current = "lg";
            setNested(true);
          }}
        >
          Anidado (ConfirmDialog encima)
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard align="left" label="Efectivo (pesos)" value="$ 1.284.500" hint="≈ U$ 877" />
        <StatCard align="left" label="Transferencia" value="$ 2.130.000" hint="≈ U$ 1.454" />
        <StatCard align="left" label="Tarjeta de crédito" value="$ 846.300" hint="≈ U$ 578" />
        <StatCard align="left" label="Total (ARS)" value="$ 4.260.800" hint="≈ U$ 2.908" />
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="px-5 py-3">Fecha</th>
              <th className="px-5 py-3">Concepto</th>
              <th className="px-5 py-3">Caja</th>
              <th className="px-5 py-3 text-end">Monto</th>
            </tr>
          </thead>
          <tbody>
            {FILAS.map((f) => (
              <tr key={f[1]}>
                {f.map((c, i) => (
                  <td key={i} className={i === 3 ? "px-5 py-2.5 text-end tabular-nums" : "px-5 py-2.5"}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Dialog
        open={abierto !== null}
        onClose={() => setAbierto(null)}
        size={abierto ?? "lg"}
        title={`Nuevo movimiento · ${abierto ?? ""}`}
        description="Se registra en la caja elegida y queda en el historial."
        footer={
          <>
            <Button variant="outline" onClick={() => setAbierto(null)}>
              Cancelar
            </Button>
            <Button onClick={() => setAbierto(null)}>Registrar movimiento</Button>
          </>
        }
      >
        <Formulario largo={abierto === "xl" || abierto === "2xl"} />
      </Dialog>

      <Dialog
        open={sinFooter}
        onClose={() => setSinFooter(false)}
        size="md"
        title="Sin footer"
        description="Solo cuerpo, para mensajes."
      >
        <p className="text-sm text-neutral-600">
          Un modal sin botones de footer, con una línea de texto.
        </p>
      </Dialog>

      <Dialog
        open={nested}
        onClose={() => setNested(false)}
        size="lg"
        title="Alta con confirmación"
        description="Abre un ConfirmDialog encima para probar el overlay anidado."
        footer={
          <>
            <Button variant="outline" onClick={() => setNested(false)}>
              Cancelar
            </Button>
            <Button>Guardar</Button>
          </>
        }
      >
        <Formulario />
      </Dialog>

      <ConfirmDemo
        open={nested}
        onClose={() => setNested(false)}
      />
    </main>
  );
}

/** ConfirmDialog local (no importa el real para no arrastrar lógica) sobre el
 * dialog de arriba: el overlay de arriba NO vuelve a blurrear. */
function ConfirmDemo({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title="¿Eliminar movimiento?"
      description="Esta acción no se puede deshacer."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={onClose}>
            Eliminar
          </Button>
        </>
      }
    >
      <p className="text-sm text-neutral-600">
        Se eliminará el movimiento seleccionado.
      </p>
    </Dialog>
  );
}
