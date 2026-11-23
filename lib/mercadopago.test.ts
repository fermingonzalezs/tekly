import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  firmaWebhookValida,
  inicioDelCobro,
  normalizarEstadoMp,
  leerReferenciaSuscripcion,
  periodoHasta,
  referenciaSuscripcion,
} from "./mercadopago";

const ORG = "b2175a9f-964f-45c3-838d-524187aa3296";

describe("referencia de suscripción", () => {
  it("ida y vuelta", () => {
    expect(leerReferenciaSuscripcion(referenciaSuscripcion(ORG, "business", "anual"))).toEqual({
      orgId: ORG,
      plan: "business",
      ciclo: "anual",
    });
  });

  it("las referencias viejas sin ciclo son mensuales", () => {
    expect(leerReferenciaSuscripcion(`${ORG}:starter`)).toEqual({ orgId: ORG, plan: "starter", ciclo: "mensual" });
    expect(leerReferenciaSuscripcion(`${ORG}:starter:semanal`)).toBeNull();
  });

  it("rechaza referencias ajenas o con plan inválido", () => {
    expect(leerReferenciaSuscripcion("YG-1234")).toBeNull();
    expect(leerReferenciaSuscripcion(`${ORG}:trial`)).toBeNull();
    expect(leerReferenciaSuscripcion(`${ORG}:gold`)).toBeNull();
    expect(leerReferenciaSuscripcion(`no-es-uuid:starter`)).toBeNull();
    expect(leerReferenciaSuscripcion(null)).toBeNull();
  });
});

describe("firmaWebhookValida", () => {
  const secreto = "clave";
  const firmar = (manifest: string) => createHmac("sha256", secreto).update(manifest).digest("hex");

  it("acepta la firma correcta (data.id en minúsculas)", () => {
    const v1 = firmar("id:abc123;request-id:req-1;ts:1704908010;");
    expect(
      firmaWebhookValida({ xSignature: `ts=1704908010,v1=${v1}`, xRequestId: "req-1", dataId: "ABC123", secreto }),
    ).toBe(true);
  });

  it("rechaza firma alterada, sin header o de otro id", () => {
    const v1 = firmar("id:abc123;request-id:req-1;ts:1704908010;");
    expect(firmaWebhookValida({ xSignature: `ts=1704908010,v1=${v1}`, xRequestId: "req-1", dataId: "otro", secreto })).toBe(false);
    expect(firmaWebhookValida({ xSignature: null, xRequestId: "req-1", dataId: "abc123", secreto })).toBe(false);
    expect(firmaWebhookValida({ xSignature: "ts=1,v1=00", xRequestId: "req-1", dataId: "abc123", secreto })).toBe(false);
  });
});

describe("periodoHasta", () => {
  const ahora = new Date("2026-11-23T12:00:00Z");

  it("usa la próxima fecha de cobro", () => {
    expect(periodoHasta({ proximoCobro: "2026-12-23T12:00:00.000-03:00", periodoActual: null, ahora })).toBe(
      "2026-12-23T15:00:00.000Z",
    );
  });

  it("sin fecha de cobro, un mes desde ahora", () => {
    expect(periodoHasta({ proximoCobro: null, periodoActual: null, ahora })).toBe("2026-12-23T12:00:00.000Z");
  });

  it("anual sin fecha de cobro: 12 meses", () => {
    expect(periodoHasta({ proximoCobro: null, periodoActual: null, ahora, ciclo: "anual" })).toBe(
      "2027-11-23T12:00:00.000Z",
    );
  });

  it("nunca acorta un período ya pago", () => {
    expect(
      periodoHasta({ proximoCobro: "2026-12-23T12:00:00Z", periodoActual: "2027-01-10T00:00:00.000Z", ahora }),
    ).toBe("2027-01-10T00:00:00.000Z");
  });
});

describe("normalizarEstadoMp", () => {
  it("acepta cancelled (API) y canceled (doc), descarta lo desconocido", () => {
    expect(normalizarEstadoMp("cancelled")).toBe("canceled");
    expect(normalizarEstadoMp("canceled")).toBe("canceled");
    expect(normalizarEstadoMp("authorized")).toBe("authorized");
    expect(normalizarEstadoMp("finished")).toBeNull();
  });
});

describe("inicioDelCobro", () => {
  const ahora = new Date("2026-11-23T12:00:00Z");
  it("en prueba, el primer cobro es al terminarla", () => {
    expect(inicioDelCobro("2026-12-20T12:00:00Z", true, ahora)).toBe("2026-12-20T12:00:00.000Z");
  });
  it("sin prueba, prueba vencida o a menos de un día: cobra ya", () => {
    expect(inicioDelCobro("2026-12-20T12:00:00Z", false, ahora)).toBeNull();
    expect(inicioDelCobro("2026-11-20T12:00:00Z", true, ahora)).toBeNull();
    expect(inicioDelCobro("2026-11-24T06:00:00Z", true, ahora)).toBeNull();
  });
});
