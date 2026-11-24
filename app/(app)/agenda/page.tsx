import { Section } from "@/components/section";
import { requireUser } from "@/lib/auth";
import { listTurnosProximos, listTurnosRango } from "@/lib/db/turnos";
import { listPedidosRango } from "@/lib/db/pedidos";
import { listCelulares, listOtros } from "@/lib/db/inventario";
import { listTickets, listTecnicos } from "@/lib/db/reparaciones";
import { listClientesOpciones } from "@/lib/db/clientes";
import { getNegocio } from "@/lib/db/configuracion";
import { parseFiltrosAgenda, rangoDeVista } from "@/lib/agenda";
import { hoyISO } from "@/lib/date-presets";
import { AgendaClient } from "./agenda-client";

export default async function TurnosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const hoy = hoyISO();
  const { vista, fecha } = parseFiltrosAgenda(await searchParams, hoy);
  const { desde, hasta } = rangoDeVista(vista, fecha);

  const [turnos, pedidos, proximos, celulares, otros, tickets, clientesOpciones, atendientes, user, negocio] =
    await Promise.all([
      listTurnosRango(desde, hasta),
      listPedidosRango(desde, hasta),
      listTurnosProximos(),
      listCelulares(),
      listOtros(),
      listTickets(),
      listClientesOpciones(),
      listTecnicos(),
      requireUser(),
      getNegocio(),
    ]);

  return (
    <Section title="Agenda" ayuda="turnos">
      <AgendaClient
        vista={vista}
        fecha={fecha}
        hoy={hoy}
        turnos={turnos}
        pedidos={pedidos}
        proximos={proximos}
        celulares={celulares}
        otros={otros}
        ticketsListos={tickets.filter((t) => t.estado === "listo")}
        clientesOpciones={clientesOpciones}
        atendientes={atendientes}
        user={user}
        negocio={negocio}
      />
    </Section>
  );
}
