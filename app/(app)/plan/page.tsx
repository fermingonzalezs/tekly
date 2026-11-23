import { Check } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listMiembros } from "@/lib/db/configuracion";
import { getSuscripcionMp } from "@/lib/db/suscripciones";
import { mercadoPagoConfigurado } from "@/lib/mercadopago-api";
import { BotonSuscribirse, CancelarSuscripcion } from "./suscripcion-client";
import { Section } from "@/components/section";
import { Card } from "@/components/ui/card";
import { ChartTitle } from "@/components/ui/chart-title";
import { StatCard } from "@/components/ui/stat-card";
import { fmtArs, fmtDayMonth } from "@/lib/format";
import {
  PLANES,
  PLANES_PAGOS,
  cupoUsuarios,
  estadoDeAcceso,
  motivoSoloLectura,
} from "@/lib/planes";
import { cn } from "@/lib/utils";

/** Plan actual, uso y planes disponibles. Con `MERCADOPAGO_ACCESS_TOKEN` el
 * admin se suscribe con débito automático (Mercado Pago); sin él, queda el
 * aviso de pago por transferencia y el admin de plataforma asigna el plan. */
export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ mp?: string }>;
}) {
  const { mp: mpParam } = await searchParams;
  const user = await requireUser();
  const s = user.suscripcion;
  const acceso = estadoDeAcceso(s);
  const miembros = user.rol === "admin" ? await listMiembros() : [];
  const conMp = user.rol === "admin" && mercadoPagoConfigurado();
  const mp = conMp ? await getSuscripcionMp() : null;
  const debitoActivo = mp?.estado === "authorized";
  const cupo = cupoUsuarios(s.plan, miembros.filter((m) => m.activo).length);
  const contacto = process.env.NEXT_PUBLIC_CONTACTO_EMAIL;

  const estadoLabel =
    acceso.modo === "solo_lectura"
      ? motivoSoloLectura(acceso.motivo)
      : acceso.modo === "trial"
        ? `Prueba gratis: ${acceso.diasRestantes} ${acceso.diasRestantes === 1 ? "día" : "días"} restantes`
        : s.periodoTerminaAt
          ? `Activo hasta el ${fmtDayMonth(s.periodoTerminaAt)}`
          : "Activo";

  return (
    <Section title="Plan">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Plan actual" value={PLANES[s.plan].label} hint={estadoLabel} />
          <StatCard
            label="Usuarios"
            value={user.rol === "admin" ? `${cupo.usados} / ${cupo.max}` : cupo.max}
            hint={user.rol === "admin" ? "activos del plan" : "incluidos en el plan"}
          />
          <StatCard
            label="Precio"
            value={PLANES[s.plan].precioArs ? fmtArs(PLANES[s.plan].precioArs!) : "Gratis"}
            hint={PLANES[s.plan].precioArs ? "por mes" : "30 días, sin tarjeta"}
          />
        </div>

        {user.rol === "admin" ? (
          <Card className="p-5">
            <ChartTitle
              align="left"
              divider
              sub="Cambiás de plan cuando tu negocio crece. Tus datos siempre se conservan."
            >
              Planes
            </ChartTitle>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {PLANES_PAGOS.map((id) => {
                const p = PLANES[id];
                const actual = s.plan === id;
                return (
                  <div
                    key={id}
                    className={cn(
                      "rounded-2xl border p-4",
                      actual ? "border-accent bg-accent-soft" : "border-neutral-200",
                    )}
                  >
                    <p className="text-sm font-semibold text-neutral-900">{p.label}</p>
                    <p className="mt-1 font-grotesk text-2xl font-semibold tabular-nums text-neutral-900">
                      {fmtArs(p.precioArs!)}
                      <span className="text-[13px] font-normal text-neutral-500"> /mes</span>
                    </p>
                    <p className="mt-3 flex items-center gap-2 text-[13px] text-neutral-700">
                      <Check className="h-4 w-4 text-accent" />
                      {p.maxUsuarios === 1 ? "1 usuario" : `Hasta ${p.maxUsuarios} usuarios`}
                    </p>
                    <p className="mt-1.5 flex items-center gap-2 text-[13px] text-neutral-700">
                      <Check className="h-4 w-4 text-accent" />
                      Todos los módulos
                    </p>
                    {actual && (
                      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-accent">
                        Tu plan actual
                      </p>
                    )}
                    {conMp && !(actual && debitoActivo) && (
                      <BotonSuscribirse
                        plan={id}
                        emailInicial={mp?.payerEmail ?? user.email}
                        label={debitoActivo ? "Cambiar a este plan" : "Suscribirme"}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            {mpParam === "volver" && !debitoActivo && (
              <p className="mt-5 rounded-lg bg-accent-soft px-3 py-2 text-[13px] text-neutral-700">
                Estamos esperando la confirmación de Mercado Pago. Puede tardar unos minutos: recargá
                esta página en un rato.
              </p>
            )}
            {debitoActivo && (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 px-4 py-3">
                <p className="text-[13px] text-neutral-700">
                  Débito automático activo con Mercado Pago
                  {mp?.payerEmail ? ` (${mp.payerEmail})` : ""}.
                </p>
                <CancelarSuscripcion
                  hasta={s.periodoTerminaAt ? fmtDayMonth(s.periodoTerminaAt) : null}
                />
              </div>
            )}
            {mp?.estado === "canceled" && (
              <p className="mt-5 text-[13px] text-neutral-600">
                Cancelaste el débito automático. Podés volver a suscribirte cuando quieras.
              </p>
            )}
            {!conMp && (
              <p className="mt-5 text-[13px] text-neutral-600">
                Por ahora el pago es por transferencia: elegí un plan y escribinos para activarlo.
                {contacto ? (
                  <>
                    {" "}
                    <a
                      href={`mailto:${contacto}?subject=${encodeURIComponent(`Activar plan — ${user.organizationNombre}`)}`}
                      className="font-semibold text-accent underline underline-offset-2"
                    >
                      {contacto}
                    </a>
                  </>
                ) : null}
              </p>
            )}
            <p className="mt-1 text-[11px] text-neutral-500">
              Precios de referencia en pesos argentinos, sujetos a confirmación.
            </p>
          </Card>
        ) : (
          <Card className="p-5 text-sm text-neutral-600">
            El plan de la cuenta lo administra el administrador de tu organización.
          </Card>
        )}
      </div>
    </Section>
  );
}
