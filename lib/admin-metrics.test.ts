import { describe, expect, it } from "vitest";
import {
  DIAS_ACTIVO_PLATAFORMA,
  metricasPorOrganizacion,
  usuariosDetalle,
  type AdminClienteRow,
  type AdminLoginRow,
  type AdminOrgRow,
  type AdminPerfilRow,
  type AdminTicketRow,
  type AdminVentaRow,
} from "@/lib/admin-metrics";

const HOY = new Date(2026, 8, 25); // 25 sep 2026 — fecha fija, determinística

function org(id: string, nombre: string): AdminOrgRow {
  return { id, nombre, plan: "free", creadaEl: `2026-01-15T10:00:00.000Z` };
}

function perfil(
  id: string,
  organizationId: string,
  overrides: Partial<AdminPerfilRow> = {},
): AdminPerfilRow {
  return {
    id,
    organizationId,
    rol: "vendedor",
    nombre: `Usuario ${id}`,
    email: `${id}@tekly.test`,
    activo: true,
    ...overrides,
  };
}

function login(userId: string, ultimoLogin: string | null): AdminLoginRow {
  return { userId, ultimoLogin };
}

function venta(
  organizationId: string,
  fecha: string,
  totalUsd: number,
): AdminVentaRow {
  return { organizationId, fecha, totalUsd };
}

function ticket(
  organizationId: string,
  estado: AdminTicketRow["estado"],
): AdminTicketRow {
  return { organizationId, estado };
}

describe("metricasPorOrganizacion", () => {
  it("cuenta ventas/facturación solo del mes en curso y tickets solo abiertos", () => {
    const orgs = [org("A", "Tienda A"), org("B", "Tienda B")];
    const perfiles = [
      perfil("u1", "A"),
      perfil("u2", "A"),
      perfil("u3", "B"),
    ];
    const ventas = [
      venta("A", "2026-09-01T10:00:00.000Z", 100),
      venta("A", "2026-09-20T15:00:00.000Z", 50),
      // Mes anterior: no cuenta para "del mes".
      venta("A", "2026-08-31T23:00:00.000Z", 999),
      // De la otra org: no cuenta para A.
      venta("B", "2026-09-10T10:00:00.000Z", 200),
    ];
    const tickets = [
      ticket("A", "recibido"),
      ticket("A", "listo"),
      ticket("A", "entregado"), // entregado no es "abierto"
      ticket("B", "en_reparacion"),
    ];
    const clientes: AdminClienteRow[] = [
      { organizationId: "A" },
      { organizationId: "A" },
      { organizationId: "A" },
      { organizationId: "B" },
    ];

    const metricas = metricasPorOrganizacion({
      orgs,
      perfiles,
      ventas,
      tickets,
      clientes,
      logins: [],
      hoy: HOY,
    });

    const a = metricas.find((m) => m.orgId === "A")!;
    expect(a.usuarios).toBe(2);
    expect(a.ventasMes).toBe(2);
    expect(a.facturacionMesUsd).toBe(150);
    expect(a.ticketsAbiertos).toBe(2);
    expect(a.clientesTotal).toBe(3);

    const b = metricas.find((m) => m.orgId === "B")!;
    expect(b.ventasMes).toBe(1);
    expect(b.facturacionMesUsd).toBe(200);
    expect(b.ticketsAbiertos).toBe(1);
  });

  it("cuenta como activo solo quien entró en los últimos 30 días, y ultimoLogin es el más reciente", () => {
    // Timestamps absolutos (no strings a mano): el borde de la ventana no
    // puede depender del huso horario de la máquina que corre el test.
    const hoyMs = new Date(2026, 8, 25, 12, 0, 0).getTime();
    const hace29d = new Date(hoyMs - 29 * 86400000).toISOString();
    const borde30d = new Date(hoyMs - DIAS_ACTIVO_PLATAFORMA * 86400000).toISOString();
    const hace31d = new Date(hoyMs - 31 * 86400000).toISOString();
    const HOY = new Date(hoyMs);

    const orgs = [org("A", "Tienda A")];
    const perfiles = [
      perfil("u1", "A"),
      perfil("u2", "A"),
      perfil("u3", "A"),
      perfil("u4", "A"),
    ];
    const logins = [
      login("u1", hace29d),
      login("u2", borde30d),
      login("u3", hace31d),
      login("u4", null),
    ];

    const [a] = metricasPorOrganizacion({
      orgs,
      perfiles,
      ventas: [],
      tickets: [],
      clientes: [],
      logins,
      hoy: HOY,
    });

    expect(a.usuariosActivos30d).toBe(2); // 29d y el borde exacto; 31d y nunca no
    expect(a.ultimoLogin).toBe(hace29d);
  });

  it("una org sin logins no tiene usuarios activos ni ultimoLogin (no null-safe crash)", () => {
    const [a] = metricasPorOrganizacion({
      orgs: [org("A", "Tienda A")],
      perfiles: [perfil("u1", "A")],
      ventas: [],
      tickets: [],
      clientes: [],
      logins: [login("u1", null)],
      hoy: HOY,
    });
    expect(a.usuariosActivos30d).toBe(0);
    expect(a.ultimoLogin).toBeNull();
  });

  it("ordena por facturación del mes descendente y a equaldad por nombre", () => {
    const metricas = metricasPorOrganizacion({
      orgs: [org("Z", "Zeta"), org("M", "Eme"), org("A", "Alpha")],
      perfiles: [],
      ventas: [
        venta("Z", "2026-09-10T10:00:00.000Z", 100),
        venta("M", "2026-09-10T10:00:00.000Z", 300),
        venta("A", "2026-09-10T10:00:00.000Z", 100),
      ],
      tickets: [],
      clientes: [],
      logins: [],
      hoy: HOY,
    });
    expect(metricas.map((m) => m.orgId)).toEqual(["M", "A", "Z"]);
  });

  it("ignora ventas del mismo mes de otro año", () => {
    const [a] = metricasPorOrganizacion({
      orgs: [org("A", "Tienda A")],
      perfiles: [],
      ventas: [venta("A", "2025-09-10T10:00:00.000Z", 500)],
      tickets: [],
      clientes: [],
      logins: [],
      hoy: HOY,
    });
    expect(a.ventasMes).toBe(0);
    expect(a.facturacionMesUsd).toBe(0);
  });
});

describe("usuariosDetalle", () => {
  it("resuelve el ultimoLogin por usuario y ordena por nombre", () => {
    const perfiles = [
      perfil("u2", "A", { nombre: "Zoe" }),
      perfil("u1", "A", { nombre: "Ana", rol: "admin" }),
      perfil("u3", "A", { nombre: "Bo", activo: false }),
    ];
    const usuarios = usuariosDetalle(perfiles, [
      login("u1", "2026-09-05T12:00:00.000Z"),
      login("u2", "2026-01-02T12:00:00.000Z"),
    ]);
    expect(usuarios.map((u) => u.nombre)).toEqual(["Ana", "Bo", "Zoe"]);
    expect(usuarios[0]).toMatchObject({
      rol: "admin",
      activo: true,
      ultimoLogin: "2026-09-05T12:00:00.000Z",
    });
    // Bo no tiene fila en logins (nunca entró, no está en listUsers): null.
    expect(usuarios[1].ultimoLogin).toBeNull();
    // Zoe entró hace tiempo: su último login viaja tal cual.
    expect(usuarios[2].ultimoLogin).toBe("2026-01-02T12:00:00.000Z");
  });
});
