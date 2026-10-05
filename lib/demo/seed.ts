/** Seed determinista de la demo sin cuenta (plan 014, paso 1).
 *
 * `crearSeedDemo(hoy)` es 100 % puro: no usa `Math.random` ni `Date.now`, la
 * fecha se inyecta para que SSR, hidratación y tests coincidan. Vive acá (y
 * no en `lib/db/*`) porque la demo no puede tocar Supabase -- ver el guard de
 * aislamiento del plan 014.
 */

import type {
  Caja,
  ClienteOpcion,
  Equipo,
  OtroItem,
  Pago,
  Repuesto,
  Servicio,
  Ticket,
  TicketStatus,
  Turno,
  TurnoEstado,
  TurnoTipo,
  Venta,
  VentaItem,
} from "@/lib/types";
import type { Negocio } from "@/lib/db/configuracion";
import { fmtDayMonth } from "@/lib/format";
import { sumarDias } from "@/lib/date-presets";
import { margenVenta, montoConRecargo } from "@/lib/ventas";

export type DemoState = {
  ventas: Venta[];
  equipos: Equipo[];
  clientes: ClienteOpcion[];
  repuestos: Repuesto[];
  otros: OtroItem[];
  servicios: Servicio[];
  cajas: Caja[];
  turnos: Turno[];
  tickets: Ticket[];
  negocio: Negocio;
  contadorVentas: number;
};

/** Dólar de referencia del seed -- mismo fallback que `useDolar()`. */
const DOLAR_DEMO = 1465;

// ─────────────────────────── Datos base ───────────────────────────

const CLIENTES_DEMO = [
  "Lucía Fernández",
  "Martín Gómez",
  "Sofía Ramírez",
  "Julián Torres",
  "Camila Sosa",
  "Nicolás Ríos",
  "Valentina Pereyra",
  "Tomás Aguirre",
  "Agustina Molina",
  "Franco Benítez",
  "Martina Castro",
  "Gonzalo Vega",
];

const MODELOS: [string, string, string][] = [
  ["iPhone 11", "64GB", "Negro"],
  ["iPhone 11", "128GB", "Blanco"],
  ["iPhone 12", "128GB", "Azul"],
  ["iPhone 12 Pro", "256GB", "Grafito"],
  ["iPhone 13", "128GB", "Rosa"],
  ["iPhone 13 Pro", "256GB", "Verde"],
  ["iPhone 14", "128GB", "Medianoche"],
  ["iPhone 14 Pro", "256GB", "Morado"],
  ["iPhone 15", "128GB", "Azul"],
  ["iPhone 15 Pro", "256GB", "Titanio natural"],
  ["iPhone SE", "64GB", "Rojo"],
  ["iPhone XR", "128GB", "Coral"],
  ["iPhone 12 mini", "64GB", "Verde"],
  ["iPhone 13 mini", "128GB", "Medianoche"],
  ["iPhone 14 Plus", "256GB", "Amarillo"],
];

const BATERIAS = [87, 90, 82, 95, 88, 91, 84, 97, 89, 93, 79, 86, 90, 85, 92];
const CONDICIONES = [
  "A+", "A", "A", "B+", "A", "A+", "B", "A+", "A", "A", "B+", "A", "A+", "A", "B+",
];
const PRECIOS = [450, 520, 620, 780, 720, 900, 850, 1050, 980, 1250, 380, 480, 550, 700, 1000];
const COSTOS = [320, 380, 460, 590, 540, 690, 640, 820, 760, 980, 270, 350, 400, 520, 780];

const REPUESTOS_BASE: Omit<Repuesto, "id">[] = [
  { sku: "PNT-11", nombre: "Pantalla iPhone 11", modelo: "iPhone 11", stock: 6, stockMin: 2, costoUsd: 120, proveedor: "Import Cell" },
  { sku: "PNT-12", nombre: "Pantalla iPhone 12", modelo: "iPhone 12", stock: 2, stockMin: 2, costoUsd: 150, proveedor: "Import Cell" },
  { sku: "BAT-13", nombre: "Batería iPhone 13", modelo: "iPhone 13", stock: 9, stockMin: 3, costoUsd: 45, proveedor: "TecnoPartes" },
  { sku: "MOD-11", nombre: "Módulo iPhone 11", modelo: "iPhone 11", stock: 1, stockMin: 2, costoUsd: 180, proveedor: "Import Cell" },
  { sku: "PIN-CG", nombre: "Pin de carga universal", modelo: "Varios", stock: 15, stockMin: 5, costoUsd: 8, proveedor: "TecnoPartes" },
  { sku: "TAP-CAM", nombre: "Tapa cámara iPhone 14", modelo: "iPhone 14", stock: 4, stockMin: 2, costoUsd: 20, proveedor: "Partes Ya" },
  { sku: "ALT-13", nombre: "Altavoz iPhone 13", modelo: "iPhone 13", stock: 3, stockMin: 1, costoUsd: 25, proveedor: "TecnoPartes" },
  { sku: "VID-TRA", nombre: "Vidrio trasero iPhone 12", modelo: "iPhone 12", stock: 0, stockMin: 3, costoUsd: 30, proveedor: "Partes Ya" },
];

const SERVICIOS_BASE: Omit<Servicio, "id">[] = [
  { nombre: "Cambio de pantalla", precioUsd: 180, garantiaDias: 90, activo: true },
  { nombre: "Cambio de batería", precioUsd: 90, garantiaDias: 180, activo: true },
  { nombre: "Cambio de módulo", precioUsd: 160, garantiaDias: 90, activo: true },
  { nombre: "Reparación de pin de carga", precioUsd: 70, garantiaDias: 60, activo: true },
  { nombre: "Limpieza y software", precioUsd: 40, garantiaDias: 30, activo: true },
];

const PROCEDENCIAS = ["Local", "WhatsApp", "Instagram", "Mercado Libre"];

const VENDEDORES = [
  { id: "demo-vendedor-1", nombre: "Ana Pérez" },
  { id: "demo-vendedor-2", nombre: "Diego Luna" },
  { id: "demo-vendedor-3", nombre: "Paula Suárez" },
];

const TECNICOS = [
  { id: "demo-tecnico-1", nombre: "Ramiro Díaz" },
  { id: "demo-tecnico-2", nombre: "Carla Núñez" },
];

/** Días hacia atrás de cada una de las 40 ventas -- cae dentro de los
 * últimos 70 días y deja varias en el mes en curso y en el anterior. */
const DIAS_ATRAS = [
  0, 0, 1, 1, 2, 3, 3, 4, 5, 6,
  7, 8, 9, 10, 11, 13, 15, 17, 19, 21,
  23, 25, 27, 29, 31, 33, 35, 37, 39, 41,
  43, 45, 47, 49, 52, 55, 58, 62, 66, 69,
];

const TURNOS_DEMO: { dayOffset: number; hora: string; tipo: TurnoTipo; estado: TurnoEstado }[] = [
  { dayOffset: 0, hora: "09:00", tipo: "deja", estado: "confirmado" },
  { dayOffset: 0, hora: "11:00", tipo: "retira", estado: "pendiente" },
  { dayOffset: 1, hora: "10:00", tipo: "compra", estado: "confirmado" },
  { dayOffset: 1, hora: "16:00", tipo: "cotizar", estado: "pendiente" },
  { dayOffset: 2, hora: "12:00", tipo: "deja", estado: "confirmado" },
  { dayOffset: 3, hora: "15:00", tipo: "retira", estado: "confirmado" },
  { dayOffset: 5, hora: "09:00", tipo: "compra", estado: "pendiente" },
  { dayOffset: 6, hora: "17:00", tipo: "cotizar", estado: "confirmado" },
];

const TICKETS_DEMO: {
  atras: number;
  hora: string;
  equipo: string;
  falla: string;
  estado: TicketStatus;
}[] = [
  { atras: 1, hora: "10:15", equipo: "iPhone 12", falla: "Pantalla rota", estado: "recibido" },
  { atras: 2, hora: "12:40", equipo: "iPhone 13", falla: "No carga", estado: "en_reparacion" },
  { atras: 4, hora: "09:30", equipo: "iPhone 11", falla: "Batería dura poco", estado: "esperando_repuesto" },
  { atras: 6, hora: "17:05", equipo: "iPhone 14", falla: "Cámara trasera borrosa", estado: "listo" },
  { atras: 9, hora: "11:20", equipo: "iPhone XR", falla: "No enciende", estado: "diagnosticado" },
  { atras: 12, hora: "16:45", equipo: "iPhone 13 mini", falla: "Altavoz sin sonido", estado: "entregado" },
];

// ─────────────────────────── Helpers ───────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** `YYYY-MM-DD` a partir de la fecha **local** de `d` -- nunca
 * `toISOString()` (que es UTC y corre un día en ART después de las 21 h). */
export function fechaISOLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Fecha corta "DD mmm" sin el corrimiento de huso de parsear un date-only:
 * se ancla al mediodía local antes de formatear. */
export function fechaDisplayDe(iso: string): string {
  return fmtDayMonth(`${iso}T12:00:00`);
}

// ─────────────────────────── Seed ───────────────────────────

export function crearSeedDemo(hoy: Date): DemoState {
  const isoHoy = fechaISOLocal(hoy);

  const clientes: ClienteOpcion[] = CLIENTES_DEMO.map((nombre, i) => ({
    id: `demo-cliente-${i + 1}`,
    nombre,
    telefono: `11-${String(4000 + i).slice(-4)}-${String(1000 + i).slice(-4)}`,
    email: `cliente${i + 1}@demo.tekly`,
  }));

  const equipos: Equipo[] = MODELOS.map(
    ([modelo, almacenamiento, color], i): Equipo => ({
      id: `demo-equipo-${i + 1}`,
      modelo,
      almacenamiento,
      color,
      imei: String(860000000000000 + i + 1),
      bateria: BATERIAS[i],
      condicion: CONDICIONES[i],
      costoUsd: COSTOS[i],
      precioUsd: PRECIOS[i],
      estado: i < 6 ? "vendido" : i < 12 ? "disponible" : "reservado",
    }),
  );

  const repuestos: Repuesto[] = REPUESTOS_BASE.map((r, i) => ({
    ...r,
    id: `demo-repuesto-${i + 1}`,
  }));

  const otros: OtroItem[] = [
    {
      id: "demo-otro-1",
      nombre: "iPad 9ª gen",
      descripcion: 'iPad 10.2" 64GB',
      categoria: "ipad",
      precioUsd: 420,
      serializado: true,
      unidades: [
        { serial: "DMPIPAD0001", color: "Gris espacial", costoUsd: 300, estado: "disponible" },
        { serial: "DMPIPAD0002", color: "Plata", costoUsd: 310, estado: "disponible" },
        { serial: "DMPIPAD0003", color: "Azul", costoUsd: 320, estado: "vendido" },
      ],
    },
    {
      id: "demo-otro-2",
      nombre: "AirPods 3ª gen",
      descripcion: "AirPods con estuche de carga Lightning",
      categoria: "airpods",
      precioUsd: 180,
      serializado: false,
      cantidad: 8,
      costoUsd: 110,
    },
    {
      id: "demo-otro-3",
      nombre: "Funda MagSafe",
      categoria: "accesorio",
      precioUsd: 30,
      serializado: false,
      cantidad: 20,
      costoUsd: 8,
    },
  ];

  const servicios: Servicio[] = SERVICIOS_BASE.map((s, i) => ({
    ...s,
    id: `demo-servicio-${i + 1}`,
  }));

  const cajas: Caja[] = [
    {
      id: "demo-caja-1",
      nombre: "Mostrador",
      moneda: "ars",
      activa: true,
      descripcion: "Efectivo en pesos",
      creadaEl: "ene 2026",
      medioPago: "pesos",
    },
    {
      id: "demo-caja-2",
      nombre: "Banco",
      moneda: "ars",
      activa: true,
      descripcion: "Transferencias",
      creadaEl: "ene 2026",
      medioPago: "transferencia",
    },
    {
      id: "demo-caja-3",
      nombre: "Caja USD",
      moneda: "usd",
      activa: true,
      descripcion: "Dólares y billeteras",
      creadaEl: "ene 2026",
      medioPago: "dolares",
    },
  ];

  // ── Ventas (40, últimos ~70 días) ──
  const equiposVendidos = equipos.filter((e) => e.estado === "vendido");
  let cursorEquipo = 0;
  let cursorRepuesto = 0;
  let cursorOtro = 0;

  const itemsDeVenta = (idx: number): VentaItem[] => {
    const out: VentaItem[] = [];
    const pushEquipo = () => {
      const e = equiposVendidos[cursorEquipo++ % equiposVendidos.length];
      out.push({
        detalle: `${e.modelo} ${e.almacenamiento} ${e.color}`,
        cantidad: 1,
        precioUsd: e.precioUsd,
        costoUsd: e.costoUsd,
        equipoId: e.id,
        categoria: "equipo",
      });
    };
    const pushServicio = () => {
      const s = servicios[(idx + out.length) % servicios.length];
      const r = repuestos[cursorRepuesto++ % repuestos.length];
      out.push({
        detalle: s.nombre,
        cantidad: 1,
        precioUsd: s.precioUsd,
        costoUsd: Math.round(s.precioUsd * 0.4),
        categoria: "servicio",
        repuestos: [{ repuestoId: r.id, nombre: r.nombre, cantidad: 1 }],
      });
    };
    const pushOtro = () => {
      const o = otros[cursorOtro++ % otros.length];
      if (o.serializado) {
        const u = o.unidades.find((x) => x.estado !== "vendido") ?? o.unidades[0];
        out.push({
          detalle: o.nombre,
          cantidad: 1,
          precioUsd: o.precioUsd,
          costoUsd: u.costoUsd,
          categoria: "otro",
        });
      } else {
        out.push({
          detalle: o.nombre,
          cantidad: 1,
          precioUsd: o.precioUsd,
          costoUsd: o.costoUsd,
          categoria: "otro",
        });
      }
    };
    const pushLibre = () => {
      out.push({
        detalle: "Cargador USB-C 20W",
        cantidad: 1,
        precioUsd: 25,
        costoUsd: idx % 4 === 0 ? undefined : 12,
        categoria: "libre",
      });
    };

    const patron = idx % 5;
    if (patron === 0) pushEquipo();
    else if (patron === 1) pushServicio();
    else if (patron === 2) pushOtro();
    else if (patron === 3) pushLibre();
    else {
      pushEquipo();
      pushServicio();
    }
    return out;
  };

  const pagosDeVenta = (idx: number, total: number): Pago[] => {
    const ars = (
      medio: "pesos" | "transferencia",
      montoUsd: number,
      cajaId: string,
      recargoPct?: number,
    ): Pago => ({
      medio,
      montoUsd,
      caja: "ars",
      cajaId,
      recargoPct,
      cotizacion: DOLAR_DEMO,
      montoArs: Math.round(montoConRecargo(montoUsd, recargoPct) * DOLAR_DEMO),
    });

    if (idx % 3 === 0) {
      const primero = round2(total * 0.6);
      const segundo = round2(total - primero);
      return [
        { medio: "dolares", montoUsd: primero, caja: "usd", cajaId: "demo-caja-3" },
        ars("pesos", segundo, "demo-caja-1"),
      ];
    }
    if (idx % 3 === 1) {
      return [ars("transferencia", total, "demo-caja-2", idx % 6 === 1 ? 5 : undefined)];
    }
    return [ars("pesos", total, "demo-caja-1")];
  };

  const ventas: Venta[] = DIAS_ATRAS.map((atras, i): Venta => {
    const numero = 1000 + i + 1;
    const fechaISO = sumarDias(isoHoy, -atras);
    const items = itemsDeVenta(i);
    const totalUsd = round2(items.reduce((a, it) => a + it.precioUsd * it.cantidad, 0));
    const pagos = pagosDeVenta(i, totalUsd);
    const vend = VENDEDORES[i % VENDEDORES.length];
    const cli = clientes[i % clientes.length];
    return {
      id: `V-${numero}`,
      fecha: fechaDisplayDe(fechaISO),
      fechaISO,
      clienteId: cli.id,
      cliente: cli.nombre,
      vendedorId: vend.id,
      vendedor: vend.nombre,
      procedencia: PROCEDENCIAS[i % PROCEDENCIAS.length],
      modalidad: i % 4 === 0 ? "mayorista" : "minorista",
      items,
      totalUsd,
      pagos,
      margenPct: margenVenta(items).margenPct ?? 0,
      tipo: i % 6 === 0 ? "reparacion" : "venta",
      tieneMovimientoCaja: pagos.some(
        (p) => p.medio !== "cuenta_corriente" && !!p.cajaId,
      ),
      tieneMovimientoCC: pagos.some((p) => p.medio === "cuenta_corriente"),
    };
  });

  // ── Turnos (próximos 7 días) ──
  const turnos: Turno[] = TURNOS_DEMO.map((t, i): Turno => {
    const cli = clientes[(i + 2) % clientes.length];
    return {
      id: `demo-turno-${i + 1}`,
      dayOffset: t.dayOffset,
      hora: t.hora,
      cliente: cli.nombre,
      clienteId: cli.id,
      tipo: t.tipo,
      estado: t.estado,
      ticketId: t.tipo === "retira" ? 2001 + (i % 3) : null,
      equipoIds: t.tipo === "compra" ? [equipos[i % equipos.length].id] : undefined,
    };
  });

  // ── Tickets (estados variados) ──
  const tickets: Ticket[] = TICKETS_DEMO.map((t, i): Ticket => {
    const cli = clientes[(i + 4) % clientes.length];
    const tec = TECNICOS[i % TECNICOS.length];
    const fechaISO = sumarDias(isoHoy, -t.atras);
    const s = servicios[i % servicios.length];
    return {
      id: 2001 + i,
      clienteId: cli.id,
      cliente: cli.nombre,
      marca: "Apple",
      equipo: t.equipo,
      imei: String(860000000100000 + i + 1),
      falla: t.falla,
      tecnicoId: tec.id,
      tecnico: tec.nombre,
      estado: t.estado,
      ingreso: `${fechaDisplayDe(fechaISO)} ${t.hora}`,
      fechaISO,
      presupuestoUsd: s.precioUsd,
      servicios: [
        {
          origen: "servicio",
          servicioId: s.id,
          nombre: s.nombre,
          precioUsd: s.precioUsd,
          cantidad: 1,
          garantiaDias: s.garantiaDias,
        },
      ],
    };
  });

  // ── Negocio ── "objetivo ~120 % de un mes típico" (últimos 30 días). ──
  const desde30 = sumarDias(isoHoy, -30);
  const facturado30 = ventas
    .filter((v) => v.fechaISO >= desde30)
    .reduce((a, v) => a + v.totalUsd, 0);

  const negocio: Negocio = {
    nombre: "Tekly Demo",
    direccion: "Av. Siempre Libre 1234, CABA",
    telefono: "11-5555-0199",
    cuit: "30-12345678-9",
    horario: "Lun a Vie 10:00–19:00 · Sáb 10:00–14:00",
    objetivoMesUsd: Math.max(1000, Math.round(facturado30 * 1.2)),
    garantiaTexto: "Garantía oficial de 12 meses",
    garantiaCondiciones:
      "Cubre fallas de fábrica del equipo. No cubre daños por golpes, humedad ni intervenciones de terceros.",
    garantiaImportante:
      "Presentá este comprobante para hacer válida la garantía.",
    garantiaCausales:
      "Daño por líquidos\nGolpes o rotura de pantalla\nApertura por otro servicio técnico",
    reparacionTerminosIngreso:
      "El equipo se recibe para diagnóstico. Presupuesto sin cargo dentro de las 48 h.",
    reparacionTerminosPresupuesto:
      "El presupuesto tiene una validez de 7 días. La reparación se inicia con la aprobación del cliente.",
    reparacionTerminosEgreso:
      "El equipo se entrega probado. Revisá el funcionamiento antes de retirarlo.",
    reparacionAclaracionesIngreso:
      "Demo: los datos son de ejemplo y se reinician al recargar la pestaña.",
    reparacionAclaracionesEgreso: "",
    recargosMediosPago: { tarjeta: 10, transferencia: 5 },
    onboardingPasos: {
      negocio: true,
      importar: true,
      cajas: true,
      usuarios: true,
      servicios: true,
    },
    colorTema: "indigo",
    logoUrl: null,
  };

  return {
    ventas,
    equipos,
    clientes,
    repuestos,
    otros,
    servicios,
    cajas,
    turnos,
    tickets,
    negocio,
    contadorVentas: 1000 + ventas.length,
  };
}
