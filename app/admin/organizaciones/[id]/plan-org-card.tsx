"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartTitle } from "@/components/ui/chart-title";
import { Field, Input, Select } from "@/components/ui/field";
import {
  PLANES,
  cupoUsuarios,
  estadoDeAcceso,
  fechaParaInput,
  motivoSoloLectura,
  type PlanEstado,
  type PlanId,
  type Suscripcion,
} from "@/lib/planes";
import { setPlanOrganizacionAction } from "./actions";

const ESTADOS: { value: PlanEstado; label: string }[] = [
  { value: "trial", label: "En prueba" },
  { value: "activo", label: "Activo (pago)" },
  { value: "vencido", label: "Vencido" },
  { value: "cancelado", label: "Cancelado" },
];

function sumarDias(desde: string, dias: number): string {
  const base = desde ? new Date(`${desde}T12:00:00Z`) : new Date();
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

/** Editor de plan de una organización (cobro manual por transferencia). Las
 * fechas viajan como `yyyy-mm-dd`; el server las pasa a fin de día en hora de
 * Argentina. */
export function PlanOrgCard({
  orgId,
  suscripcion,
  usuariosActivos,
}: {
  orgId: string;
  suscripcion: Suscripcion;
  usuariosActivos: number;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState<PlanId>(suscripcion.plan);
  const [estado, setEstado] = useState<PlanEstado>(suscripcion.estado);
  const [trial, setTrial] = useState(fechaParaInput(suscripcion.trialTerminaAt));
  const [periodo, setPeriodo] = useState(fechaParaInput(suscripcion.periodoTerminaAt));
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [pending, start] = useTransition();

  const acceso = estadoDeAcceso(suscripcion);
  const cupo = cupoUsuarios(suscripcion.plan, usuariosActivos);

  function guardar() {
    setError(null);
    setGuardado(false);
    start(async () => {
      const r = await setPlanOrganizacionAction(orgId, {
        plan,
        estado,
        trialTermina: trial || null,
        periodoTermina: periodo || null,
      });
      if (r.error) {
        setError(r.error);
        return;
      }
      setGuardado(true);
      router.refresh();
    });
  }

  return (
    <Card className="p-5">
      <ChartTitle
        align="left"
        divider
        sub={
          acceso.modo === "solo_lectura"
            ? `Solo lectura · ${motivoSoloLectura(acceso.motivo)}`
            : acceso.modo === "trial"
              ? `Prueba: ${acceso.diasRestantes} ${acceso.diasRestantes === 1 ? "día" : "días"} restantes`
              : "Al día"
        }
      >
        Plan y cobro
      </ChartTitle>
      <p className="mb-4 text-[13px] text-neutral-500">
        Usuarios activos: {cupo.usados} de {cupo.max} del plan {PLANES[suscripcion.plan].label}.
      </p>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Plan">
          <Select value={plan} onChange={(e) => setPlan(e.target.value as PlanId)}>
            {(Object.keys(PLANES) as PlanId[]).map((p) => (
              <option key={p} value={p}>
                {PLANES[p].label} · {PLANES[p].maxUsuarios}{" "}
                {PLANES[p].maxUsuarios === 1 ? "usuario" : "usuarios"}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Estado">
          <Select value={estado} onChange={(e) => setEstado(e.target.value as PlanEstado)}>
            {ESTADOS.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Fin de la prueba">
          <Input type="date" value={trial} onChange={(e) => setTrial(e.target.value)} />
        </Field>
        <Field label="Fin del período pago">
          <div className="flex gap-2">
            <Input type="date" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => {
                setPeriodo(sumarDias(periodo || new Date().toISOString().slice(0, 10), 30));
                setEstado("activo");
              }}
            >
              +30 días
            </Button>
          </div>
        </Field>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={guardar} loading={pending}>
          Guardar plan
        </Button>
        {guardado && <span className="text-[13px] text-emerald-600">Guardado.</span>}
        {error && <span className="text-[13px] text-red-600">{error}</span>}
      </div>
    </Card>
  );
}
