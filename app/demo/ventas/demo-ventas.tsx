"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Section } from "@/components/section";
import { VentasClient } from "@/app/(app)/ventas/ventas-client";
import { useDemo } from "@/lib/demo/store";
import { USUARIO_DEMO } from "@/lib/demo/usuario";
import { consultarVentas } from "@/lib/demo/ventas-query";
import { parseFiltrosVentas, rangoDe, deltaHintDe } from "@/lib/ventas-filtros";
import { contextoPeriodo, periodoAnterior } from "@/lib/date-presets";

/** Ventas de la demo: misma UI que `/ventas`, datos del store local. */
export function DemoVentas() {
  const { state, crearVenta, eliminarVenta } = useDemo();
  const searchParams = useSearchParams();

  const filtros = parseFiltrosVentas(Object.fromEntries(searchParams), {
    puedeVerCosto: true,
  });
  const rango = rangoDe(filtros);
  const rangoAnterior = periodoAnterior(filtros.preset, rango);
  const openId = searchParams.get("open");

  const consulta = useMemo(
    () => consultarVentas(state, filtros, rango, rangoAnterior, openId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, searchParams, openId],
  );

  return (
    <Section title="Ventas">
      <VentasClient
        filtros={filtros}
        contexto={contextoPeriodo(filtros.preset, rango)}
        deltaHint={deltaHintDe(filtros.preset)}
        resumen={consulta.resumen}
        resumenAnterior={consulta.resumenAnterior}
        graficos={consulta.graficos}
        ventas={consulta.ventas}
        totalVentas={consulta.totalVentas}
        items={consulta.items}
        totalItems={consulta.totalItems}
        openId={openId}
        ventaAbierta={consulta.ventaAbierta}
        clientesOpciones={state.clientes}
        equipos={state.equipos}
        otros={state.otros}
        servicios={state.servicios}
        repuestos={state.repuestos}
        vendedores={[{ id: USUARIO_DEMO.id, nombre: USUARIO_DEMO.nombre }]}
        cajas={state.cajas}
        negocio={state.negocio}
        user={USUARIO_DEMO}
        basePath="/demo/ventas"
        modoDemo
        acciones={{ crearVenta, eliminarVenta, refrescar: () => {} }}
      />
    </Section>
  );
}
