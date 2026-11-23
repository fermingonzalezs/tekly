import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { conOrganizacion, organizacionEnContexto, soloLecturaDeOrganizacion } from "@/lib/auth/scope";

/** Cliente falso con la misma forma encadenable que supabase-js. */
function falso() {
  const llamadas: string[] = [];
  const query = {
    select: (cols: string) => {
      llamadas.push(`select:${cols}`);
      return query;
    },
    eq: (col: string, val: string) => {
      llamadas.push(`eq:${col}=${val}`);
      return query;
    },
    order: () => query,
    insert: () => llamadas.push("insert"),
    delete: () => llamadas.push("delete"),
  };
  return {
    llamadas,
    client: { from: (t: string) => (llamadas.push(`from:${t}`), query), rpc: () => 1, auth: { x: 1 } },
  };
}

describe("soloLecturaDeOrganizacion", () => {
  it("cada select queda acotado a la organización", () => {
    const { client, llamadas } = falso();
    const c = soloLecturaDeOrganizacion(client, "org-1");
    c.from("ventas").select("id, total");
    expect(llamadas).toEqual(["from:ventas", "select:id, total", "eq:organization_id=org-1"]);
  });

  it("organizations se acota por id, no por organization_id", () => {
    const { client, llamadas } = falso();
    soloLecturaDeOrganizacion(client, "org-1").from("organizations").select("nombre");
    expect(llamadas).toContain("eq:id=org-1");
  });

  it("el encadenado posterior (order, etc.) sigue andando", () => {
    const { client } = falso();
    const q = soloLecturaDeOrganizacion(client, "org-1").from("ventas").select("id") as unknown as {
      order: () => unknown;
    };
    expect(() => q.order()).not.toThrow();
  });

  it("bloquea escrituras y rpc", () => {
    const { client, llamadas } = falso();
    const c = soloLecturaDeOrganizacion(client, "org-1");
    expect(() => c.from("ventas").insert()).toThrow(/solo lectura/);
    expect(() => c.from("ventas").delete()).toThrow(/solo lectura/);
    expect(() => c.rpc()).toThrow(/solo lectura/);
    expect(llamadas).not.toContain("insert");
    expect(llamadas).not.toContain("delete");
  });
});

describe("conOrganizacion", () => {
  it("el contexto vale dentro del callback (también tras un await) y no se filtra afuera", async () => {
    expect(organizacionEnContexto()).toBeUndefined();
    const dentro = await conOrganizacion("org-9", async () => {
      await Promise.resolve();
      return organizacionEnContexto();
    });
    expect(dentro).toBe("org-9");
    expect(organizacionEnContexto()).toBeUndefined();
  });

  it("dos organizaciones en paralelo no se pisan", async () => {
    const leer = (org: string, ms: number) =>
      conOrganizacion(org, async () => {
        await new Promise((r) => setTimeout(r, ms));
        return organizacionEnContexto();
      });
    expect(await Promise.all([leer("a", 20), leer("b", 5)])).toEqual(["a", "b"]);
  });
});
