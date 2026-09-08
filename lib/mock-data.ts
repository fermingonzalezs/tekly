import type {
  Cliente,
  Equipo,
  MovimientoCaja,
  OtroItem,
  Proveedor,
  Repuesto,
  Servicio,
  Ticket,
  Turno,
  Usuario,
  Venta,
} from "@/lib/types";

// ───────────────────────── Dashboard ─────────────────────────

export const dashboardMetrics = [
  { key: "ventas", label: "Ventas del mes", value: "U$ 48.250", delta: 12.4 },
  { key: "margen", label: "Margen promedio", value: "34,2 %", delta: 2.1 },
  { key: "abiertos", label: "Tickets abiertos", value: "17", delta: -8.0 },
  { key: "revision", label: "Equipos en revisión", value: "9", delta: 4.0 },
];

// ventas diarias últimos 14 días (USD)
export const salesTrend = [
  1180, 1420, 980, 1650, 2100, 1750, 1320, 1890, 2450, 2010, 1670, 2380, 2760,
  3100,
];

// desglose diario: la barra es venta total (ventas + reparaciones apiladas),
// la línea es la ganancia del día. Determinístico (sin random) para SSR estable.
export const salesDaily = salesTrend.map((total, i) => {
  const reparaciones = Math.round(
    total * (0.22 + 0.18 * Math.abs(Math.sin(i * 0.9))),
  );
  const ventas = total - reparaciones;
  const ganancia = Math.round(
    total * (0.24 + 0.13 * Math.abs(Math.cos(i * 1.4))),
  );
  return { ventas, reparaciones, ganancia };
});

export const usdArs = { value: 1465, delta: 0.7, label: "Dólar blue" };

export const monthGoal = { current: 48250, target: 65000 };

export const ticketStages = [
  { label: "Recibido", count: 4, color: "#93c5fd" },
  { label: "Diagnosticado", count: 3, color: "#60a5fa" },
  { label: "En reparación", count: 5, color: "#2563eb" },
  { label: "Esperando repuesto", count: 2, color: "#f59e0b" },
  { label: "Listo", count: 3, color: "#10b981" },
];

export const recentSales = [
  { id: "V-4821", cliente: "Juan Pérez", item: "iPhone 13 128GB", vendedor: "Caro", procedencia: "Local", monto: 735, fecha: "Hoy 14:20" },
  { id: "V-4820", cliente: "Sofía Ramos", item: "Cambio de batería 12", vendedor: "Meli", procedencia: "WhatsApp", monto: 55, fecha: "Hoy 12:05" },
  { id: "V-4819", cliente: "Marco Díaz", item: "iPhone 15 Pro 256GB", vendedor: "Caro", procedencia: "Instagram", monto: 1240, fecha: "Ayer 18:40" },
  { id: "V-4818", cliente: "Lucía V.", item: "Vidrio templado + funda", vendedor: "Meli", procedencia: "Local", monto: 22, fecha: "Ayer 17:10" },
  { id: "V-4817", cliente: "Diego F.", item: "iPhone 11 64GB", vendedor: "Caro", procedencia: "MercadoLibre", monto: 410, fecha: "Ayer 11:30" },
];

// ───────────────────────── Usuarios ─────────────────────────

export const usuarios: Usuario[] = [
  { id: "u-1", nombre: "Fermín González", alias: "Fermín G.", rol: "admin", email: "fermin@tekly.com", activo: true },
  { id: "u-2", nombre: "Carolina Ruiz", alias: "Caro", rol: "vendedor", email: "caro@tekly.com", activo: true },
  { id: "u-3", nombre: "Melina Sosa", alias: "Meli", rol: "vendedor", email: "meli@tekly.com", activo: true },
  { id: "u-4", nombre: "Nicolás Vega", alias: "Nico", rol: "tecnico", email: "nico@tekly.com", activo: true },
  { id: "u-5", nombre: "Daniela Ortiz", alias: "Dani", rol: "tecnico", email: "dani@tekly.com", activo: false },
];

export const tecnicos = usuarios.filter((u) => u.rol === "tecnico");
export const vendedores = usuarios.filter((u) => u.rol === "vendedor" || u.rol === "admin");

// ───────────────────────── Clientes ─────────────────────────

export const clientes: Cliente[] = [
  { id: "c-1", nombre: "Juan Pérez", telefono: "+54 9 11 5541-2233", email: "juanperez@gmail.com", desde: "mar 2023", compras: 3, reparaciones: 2, gastadoUsd: 1890 },
  { id: "c-2", nombre: "Sofía Ramos", telefono: "+54 9 11 6620-8890", email: "sofiar@gmail.com", desde: "ene 2024", compras: 1, reparaciones: 4, gastadoUsd: 520 },
  { id: "c-3", nombre: "Marco Díaz", telefono: "+54 9 11 3345-1122", email: "marcod@outlook.com", desde: "sep 2022", compras: 5, reparaciones: 1, gastadoUsd: 4120 },
  { id: "c-4", nombre: "Lucía Vera", telefono: "+54 9 11 7788-4410", email: "luciavera@gmail.com", desde: "jun 2024", compras: 2, reparaciones: 0, gastadoUsd: 96 },
  { id: "c-5", nombre: "Diego Fernández", telefono: "+54 9 11 2210-5567", email: "dfernandez@gmail.com", desde: "nov 2023", compras: 1, reparaciones: 3, gastadoUsd: 610 },
  { id: "c-6", nombre: "Paula Giménez", telefono: "+54 9 11 4432-9981", email: "paulagimenez@gmail.com", desde: "feb 2025", compras: 0, reparaciones: 2, gastadoUsd: 180 },
  { id: "c-7", nombre: "Andrés Molina", telefono: "+54 9 11 5567-3320", email: "amolina@gmail.com", desde: "ago 2023", compras: 4, reparaciones: 2, gastadoUsd: 3350 },
  { id: "c-8", nombre: "Valentina Cruz", telefono: "+54 9 11 6698-1145", email: "valu.cruz@gmail.com", desde: "abr 2025", compras: 1, reparaciones: 1, gastadoUsd: 815 },
];

// ───────────────────────── Servicios (catálogo) ─────────────────────────

export const servicios: Servicio[] = [
  { id: "s-1", nombre: "Cambio de pantalla", precioUsd: 90, garantiaDias: 90, activo: true },
  { id: "s-2", nombre: "Cambio de batería", precioUsd: 45, garantiaDias: 180, activo: true },
  { id: "s-3", nombre: "Cambio de pin de carga", precioUsd: 40, garantiaDias: 90, activo: true },
  { id: "s-4", nombre: "Reparación de placa", precioUsd: 160, garantiaDias: 60, activo: true },
  { id: "s-5", nombre: "Cambio de cámara trasera", precioUsd: 70, garantiaDias: 90, activo: true },
  { id: "s-6", nombre: "Cambio de vidrio trasero", precioUsd: 55, garantiaDias: 30, activo: true },
  { id: "s-7", nombre: "Diagnóstico", precioUsd: 15, garantiaDias: 0, activo: true },
  { id: "s-8", nombre: "Liberación de red", precioUsd: 35, garantiaDias: 0, activo: false },
];

// ───────────────────────── Reparaciones (tickets) ─────────────────────────

export const tickets: Ticket[] = [
  {
    id: 231, clienteId: "c-2", cliente: "Sofía Ramos", equipo: "iPhone 12", imei: "356789101234567",
    falla: "No enciende, cayó al agua", tecnicoId: "u-4", tecnico: "Nico", estado: "en_reparacion",
    ingreso: "Hoy 09:40", presupuestoUsd: 200,
    servicios: [
      { servicioId: "s-7", nombre: "Diagnóstico", precioUsd: 15 },
      { servicioId: "s-4", nombre: "Reparación de placa", precioUsd: 160 },
    ],
    nota: "Cliente avisado, espera confirmación de recuperación de datos.",
  },
  {
    id: 230, clienteId: "c-5", cliente: "Diego Fernández", equipo: "iPhone 13 Pro", imei: "356789101299881",
    falla: "Pantalla rota, táctil funciona", tecnicoId: "u-4", tecnico: "Nico", estado: "esperando_repuesto",
    ingreso: "Hoy 08:15", presupuestoUsd: 90,
    servicios: [{ servicioId: "s-1", nombre: "Cambio de pantalla", precioUsd: 90 }],
    nota: "Pantalla pedida a Tecno Import, llega mañana.",
  },
  {
    id: 229, clienteId: "c-6", cliente: "Paula Giménez", equipo: "iPhone 11", imei: "356789101245512",
    falla: "Batería dura poco, se apaga al 30%", tecnicoId: "u-5", tecnico: "Dani", estado: "presupuestado",
    ingreso: "Hoy 10:20", presupuestoUsd: 45,
    servicios: [{ servicioId: "s-2", nombre: "Cambio de batería", precioUsd: 45 }],
  },
  {
    id: 228, clienteId: "c-1", cliente: "Juan Pérez", equipo: "iPhone 14", imei: "356789101278890",
    falla: "No carga, prueba con varios cables", tecnicoId: null, tecnico: null, estado: "recibido",
    ingreso: "Hoy 11:05", presupuestoUsd: 0, servicios: [],
  },
  {
    id: 227, clienteId: "c-8", cliente: "Valentina Cruz", equipo: "iPhone 12 mini", imei: "356789101201123",
    falla: "Cámara trasera borrosa", tecnicoId: "u-4", tecnico: "Nico", estado: "aprobado",
    ingreso: "Ayer 16:30", presupuestoUsd: 85,
    servicios: [
      { servicioId: "s-5", nombre: "Cambio de cámara trasera", precioUsd: 70 },
      { servicioId: "s-7", nombre: "Diagnóstico", precioUsd: 15 },
    ],
  },
  {
    id: 226, clienteId: "c-7", cliente: "Andrés Molina", equipo: "iPhone 13", imei: "356789101266734",
    falla: "Vidrio trasero estallado", tecnicoId: "u-5", tecnico: "Dani", estado: "diagnosticado",
    ingreso: "Ayer 14:10", presupuestoUsd: 0,
    servicios: [{ servicioId: "s-6", nombre: "Cambio de vidrio trasero", precioUsd: 55 }],
  },
  {
    id: 225, clienteId: "c-3", cliente: "Marco Díaz", equipo: "iPhone 15 Pro", imei: "356789101255690",
    falla: "Micrófono bajo en llamadas", tecnicoId: "u-4", tecnico: "Nico", estado: "listo",
    ingreso: "Ayer 09:00", presupuestoUsd: 60,
    servicios: [{ servicioId: "s-3", nombre: "Cambio de pin de carga", precioUsd: 40 }, { servicioId: "s-7", nombre: "Diagnóstico", precioUsd: 15 }],
    nota: "Listo para entregar, avisar por WhatsApp.",
  },
  {
    id: 224, clienteId: "c-4", cliente: "Lucía Vera", equipo: "iPhone SE 2020", imei: "356789101233440",
    falla: "Cambio de batería preventivo", tecnicoId: "u-5", tecnico: "Dani", estado: "entregado",
    ingreso: "Lun 12:30", presupuestoUsd: 45,
    servicios: [{ servicioId: "s-2", nombre: "Cambio de batería", precioUsd: 45 }],
  },
  {
    id: 223, clienteId: "c-2", cliente: "Sofía Ramos", equipo: "iPhone XR", imei: "356789101222001",
    falla: "No toma señal", tecnicoId: "u-4", tecnico: "Nico", estado: "en_reparacion",
    ingreso: "Lun 10:00", presupuestoUsd: 160,
    servicios: [{ servicioId: "s-4", nombre: "Reparación de placa", precioUsd: 160 }],
  },
  {
    id: 222, clienteId: "c-1", cliente: "Juan Pérez", equipo: "iPhone 13", imei: "356789101211975",
    falla: "Pantalla con líneas verdes", tecnicoId: "u-5", tecnico: "Dani", estado: "entregado",
    ingreso: "Dom 15:20", presupuestoUsd: 90,
    servicios: [{ servicioId: "s-1", nombre: "Cambio de pantalla", precioUsd: 90 }],
  },
];

// ───────────────────────── Turnos ─────────────────────────

export const turnos: Turno[] = [
  { id: "t-1", dayOffset: 0, hora: "10:00", cliente: "Juan Pérez", tipo: "deja", estado: "llego", ticketId: 228 },
  { id: "t-2", dayOffset: 0, hora: "11:00", cliente: "Paula Giménez", tipo: "retira", estado: "confirmado", ticketId: 229 },
  { id: "t-3", dayOffset: 0, hora: "12:00", cliente: "Cliente WhatsApp", tipo: "cotizar", estado: "pendiente", ticketId: null },
  { id: "t-4", dayOffset: 0, hora: "16:00", cliente: "Andrés Molina", tipo: "cotizar", estado: "confirmado", ticketId: 226 },
  { id: "t-5", dayOffset: 0, hora: "17:00", cliente: "Marco Díaz", tipo: "retira", estado: "pendiente", ticketId: 225 },
  { id: "t-6", dayOffset: 1, hora: "09:00", cliente: "Valentina Cruz", tipo: "deja", estado: "confirmado", ticketId: 227 },
  { id: "t-7", dayOffset: 1, hora: "11:00", cliente: "Cliente mayorista", tipo: "compra", estado: "pendiente", ticketId: null },
  { id: "t-8", dayOffset: 1, hora: "14:00", cliente: "Diego Fernández", tipo: "retira", estado: "cancelado", ticketId: 230 },
  { id: "t-9", dayOffset: 2, hora: "10:00", cliente: "Sofía Ramos", tipo: "compra", estado: "confirmado", ticketId: null },
  { id: "t-10", dayOffset: 2, hora: "15:00", cliente: "Lucía Vera", tipo: "deja", estado: "pendiente", ticketId: null },
  { id: "t-11", dayOffset: 3, hora: "12:00", cliente: "Nicolás F.", tipo: "cotizar", estado: "pendiente", ticketId: null },
  { id: "t-12", dayOffset: 4, hora: "09:00", cliente: "Marco Díaz", tipo: "compra", estado: "confirmado", ticketId: null },
  { id: "t-13", dayOffset: 4, hora: "18:00", cliente: "Andrés Molina", tipo: "retira", estado: "pendiente", ticketId: 226 },
  { id: "t-14", dayOffset: 6, hora: "11:00", cliente: "Paula Giménez", tipo: "deja", estado: "pendiente", ticketId: null },
];

// ───────────────────────── Inventario ─────────────────────────

export const equipos: Equipo[] = [
  { id: "e-1", modelo: "iPhone 11", almacenamiento: "64GB", color: "Negro", imei: "356111000000011", bateria: 84, condicion: "Muy bueno", costoUsd: 300, precioUsd: 410, estado: "disponible" },
  { id: "e-2", modelo: "iPhone 13", almacenamiento: "128GB", color: "Azul", imei: "356111000000024", bateria: 91, condicion: "Excelente", costoUsd: 560, precioUsd: 735, estado: "disponible" },
  { id: "e-3", modelo: "iPhone 12", almacenamiento: "128GB", color: "Blanco", imei: "356111000000037", bateria: 88, condicion: "Bueno", costoUsd: 420, precioUsd: 560, estado: "aprobado_para_venta" },
  { id: "e-4", modelo: "iPhone 15 Pro", almacenamiento: "256GB", color: "Titanio natural", imei: "356111000000040", bateria: 100, condicion: "Sellado", costoUsd: 990, precioUsd: 1240, estado: "disponible" },
  { id: "e-5", modelo: "iPhone XR", almacenamiento: "64GB", color: "Coral", imei: "356111000000053", bateria: 79, condicion: "Regular", costoUsd: 170, precioUsd: 250, estado: "en_revision" },
  { id: "e-6", modelo: "iPhone 14", almacenamiento: "128GB", color: "Medianoche", imei: "356111000000066", bateria: 95, condicion: "Excelente", costoUsd: 680, precioUsd: 860, estado: "en_revision" },
  { id: "e-7", modelo: "iPhone SE 2020", almacenamiento: "64GB", color: "Rojo", imei: "356111000000079", bateria: 82, condicion: "Bueno", costoUsd: 130, precioUsd: 195, estado: "vendido" },
  { id: "e-8", modelo: "iPhone 13 mini", almacenamiento: "128GB", color: "Verde", imei: "356111000000082", bateria: 86, condicion: "Muy bueno", costoUsd: 430, precioUsd: 570, estado: "aprobado_para_venta" },
  { id: "e-9", modelo: "Samsung S22", almacenamiento: "128GB", color: "Negro", imei: "356111000000095", bateria: 90, condicion: "Bueno", costoUsd: 280, precioUsd: 380, estado: "disponible" },
];

export const repuestos: Repuesto[] = [
  { id: "r-1", sku: "PANT-OLED-11", nombre: "Pantalla OLED", modelo: "iPhone 11", stock: 4, stockMin: 3, costoUsd: 42, proveedor: "Tecno Import" },
  { id: "r-2", sku: "PANT-OLED-13", nombre: "Pantalla OLED", modelo: "iPhone 13", stock: 2, stockMin: 3, costoUsd: 68, proveedor: "Tecno Import" },
  { id: "r-3", sku: "BAT-12", nombre: "Batería", modelo: "iPhone 12", stock: 9, stockMin: 5, costoUsd: 12, proveedor: "PartsAR" },
  { id: "r-4", sku: "BAT-11", nombre: "Batería", modelo: "iPhone 11", stock: 1, stockMin: 5, costoUsd: 11, proveedor: "PartsAR" },
  { id: "r-5", sku: "FLEX-CARGA-13", nombre: "Pin de carga (flex)", modelo: "iPhone 13", stock: 6, stockMin: 4, costoUsd: 9, proveedor: "MobileFix Mayorista" },
  { id: "r-6", sku: "CAM-TRAS-12M", nombre: "Cámara trasera", modelo: "iPhone 12 mini", stock: 2, stockMin: 2, costoUsd: 28, proveedor: "Tecno Import" },
  { id: "r-7", sku: "VIDR-TRAS-13", nombre: "Vidrio trasero", modelo: "iPhone 13", stock: 0, stockMin: 3, costoUsd: 14, proveedor: "MobileFix Mayorista" },
  { id: "r-8", sku: "PANT-OLED-15P", nombre: "Pantalla OLED", modelo: "iPhone 15 Pro", stock: 3, stockMin: 2, costoUsd: 145, proveedor: "iSupply Global" },
  { id: "r-9", sku: "BAT-13P", nombre: "Batería", modelo: "iPhone 13 Pro", stock: 5, stockMin: 4, costoUsd: 15, proveedor: "PartsAR" },
  { id: "r-10", sku: "FLEX-CARGA-15", nombre: "Flex de carga", modelo: "iPhone 15", stock: 2, stockMin: 3, costoUsd: 13, proveedor: "iSupply Global" },
];

// Otros productos (no iPhone / no repuesto): iPad, AirPods, tablets, etc.
export const otros: OtroItem[] = [
  { id: "o-1", nombre: "iPad 9na gen 64GB", categoria: "ipad", cantidad: 2, costoUsd: 260, precioUsd: 330 },
  { id: "o-2", nombre: "AirPods Pro 2", categoria: "airpods", cantidad: 5, costoUsd: 140, precioUsd: 190 },
  { id: "o-3", nombre: "AirPods 3", categoria: "airpods", cantidad: 3, costoUsd: 110, precioUsd: 150 },
  { id: "o-4", nombre: "Samsung Galaxy Tab A9", categoria: "tablet", cantidad: 1, costoUsd: 130, precioUsd: 180 },
  { id: "o-5", nombre: "Cargador USB-C 20W", categoria: "accesorio", cantidad: 24, costoUsd: 4, precioUsd: 12 },
  { id: "o-6", nombre: "Cable Lightning 1m", categoria: "accesorio", cantidad: 40, costoUsd: 2, precioUsd: 8 },
  { id: "o-7", nombre: "Apple Watch SE 40mm", categoria: "otro", cantidad: 1, costoUsd: 190, precioUsd: 250 },
];

// ───────────────────────── Proveedores ─────────────────────────

export const proveedores: Proveedor[] = [
  { id: "p-1", nombre: "Tecno Import", contacto: "Gustavo Ledesma", telefono: "+54 9 11 4001-2200", rubro: "Pantallas y cámaras", ubicacion: "CABA — Once", repuestos: 3 },
  { id: "p-2", nombre: "PartsAR", contacto: "Romina Aguirre", telefono: "+54 9 11 4550-9871", rubro: "Baterías", ubicacion: "CABA — Flores", repuestos: 3 },
  { id: "p-3", nombre: "MobileFix Mayorista", contacto: "Leandro Paz", telefono: "+54 9 11 4780-3322", rubro: "Flex y vidrios", ubicacion: "GBA — San Justo", repuestos: 2 },
  { id: "p-4", nombre: "iSupply Global", contacto: "Import directo", telefono: "wa.me/8613000000000", rubro: "Repuestos premium / import", ubicacion: "Shenzhen (import)", repuestos: 2 },
  { id: "p-5", nombre: "Accesorios del Sur", contacto: "Marta Ríos", telefono: "+54 9 11 4123-8890", rubro: "Fundas, vidrios templados", ubicacion: "CABA — Villa Crespo", repuestos: 0 },
];

// ───────────────────────── Ventas / historial ─────────────────────────

export const ventas: Venta[] = [
  { id: "V-4821", fecha: "Hoy 14:20", fechaISO: "2026-09-07", clienteId: "c-1", cliente: "Juan Pérez", vendedorId: "u-2", vendedor: "Caro", procedencia: "Local", items: [{ detalle: "iPhone 13 128GB Azul", cantidad: 1, precioUsd: 735 }], totalUsd: 735, pagos: [{ medio: "transferencia", montoUsd: 735 }], margenPct: 23.8, tipo: "venta" },
  { id: "V-4820", fecha: "Hoy 12:05", fechaISO: "2026-09-07", clienteId: "c-2", cliente: "Sofía Ramos", vendedorId: "u-3", vendedor: "Meli", procedencia: "WhatsApp", items: [{ detalle: "Cambio de batería iPhone 12", cantidad: 1, precioUsd: 45 }, { detalle: "Vidrio templado", cantidad: 1, precioUsd: 10 }], totalUsd: 55, pagos: [{ medio: "tarjeta", montoUsd: 55 }], margenPct: 61.0, tipo: "reparacion" },
  { id: "V-4819", fecha: "Ayer 18:40", fechaISO: "2026-09-06", clienteId: "c-3", cliente: "Marco Díaz", vendedorId: "u-2", vendedor: "Caro", procedencia: "Instagram", items: [{ detalle: "iPhone 15 Pro 256GB", cantidad: 1, precioUsd: 1240 }], totalUsd: 1240, pagos: [{ medio: "cripto", montoUsd: 1240 }], margenPct: 20.2, tipo: "venta" },
  { id: "V-4818", fecha: "Ayer 17:10", fechaISO: "2026-09-06", clienteId: "c-4", cliente: "Lucía Vera", vendedorId: "u-3", vendedor: "Meli", procedencia: "Local", items: [{ detalle: "Vidrio templado", cantidad: 1, precioUsd: 10 }, { detalle: "Funda silicona", cantidad: 1, precioUsd: 12 }], totalUsd: 22, pagos: [{ medio: "pesos", montoUsd: 22 }], margenPct: 55.0, tipo: "venta" },
  { id: "V-4817", fecha: "Ayer 11:30", fechaISO: "2026-09-06", clienteId: "c-5", cliente: "Diego Fernández", vendedorId: "u-2", vendedor: "Caro", procedencia: "MercadoLibre", items: [{ detalle: "iPhone 11 64GB", cantidad: 1, precioUsd: 410 }], totalUsd: 410, pagos: [{ medio: "canje", montoUsd: 250 }, { medio: "pesos", montoUsd: 160 }], margenPct: 26.8, tipo: "venta" },
  { id: "V-4816", fecha: "Ayer 10:05", fechaISO: "2026-09-06", clienteId: "c-7", cliente: "Andrés Molina", vendedorId: "u-3", vendedor: "Meli", procedencia: "WhatsApp", items: [{ detalle: "Cambio de pantalla iPhone 13", cantidad: 1, precioUsd: 90 }], totalUsd: 90, pagos: [{ medio: "transferencia", montoUsd: 90 }], margenPct: 24.4, tipo: "reparacion" },
  { id: "V-4815", fecha: "Lun 19:20", fechaISO: "2026-09-04", clienteId: "c-8", cliente: "Valentina Cruz", vendedorId: "u-2", vendedor: "Caro", procedencia: "Referido", items: [{ detalle: "iPhone 13 mini 128GB", cantidad: 1, precioUsd: 570 }, { detalle: "AppleCare no oficial 6m", cantidad: 1, precioUsd: 30 }], totalUsd: 600, pagos: [{ medio: "transferencia", montoUsd: 400 }, { medio: "pesos", montoUsd: 200 }], margenPct: 22.5, tipo: "venta" },
  { id: "V-4814", fecha: "Lun 15:40", fechaISO: "2026-09-04", clienteId: "c-1", cliente: "Juan Pérez", vendedorId: "u-3", vendedor: "Meli", procedencia: "Local", items: [{ detalle: "Reparación de placa iPhone XR", cantidad: 1, precioUsd: 160 }], totalUsd: 160, pagos: [{ medio: "pesos", montoUsd: 160 }], margenPct: 40.0, tipo: "reparacion" },
  { id: "V-4813", fecha: "Lun 12:10", fechaISO: "2026-09-04", clienteId: "c-6", cliente: "Paula Giménez", vendedorId: "u-2", vendedor: "Caro", procedencia: "WhatsApp", items: [{ detalle: "Cambio de batería iPhone 11", cantidad: 1, precioUsd: 45 }], totalUsd: 45, pagos: [{ medio: "pesos", montoUsd: 45 }], margenPct: 62.2, tipo: "reparacion" },
  { id: "V-4812", fecha: "Dom 16:30", fechaISO: "2026-09-03", clienteId: "c-3", cliente: "Marco Díaz", vendedorId: "u-2", vendedor: "Caro", procedencia: "Instagram", items: [{ detalle: "iPhone 14 128GB", cantidad: 1, precioUsd: 860 }], totalUsd: 860, pagos: [{ medio: "cripto", montoUsd: 600 }, { medio: "transferencia", montoUsd: 260 }], margenPct: 20.9, tipo: "venta" },
  { id: "V-4811", fecha: "Dom 13:15", fechaISO: "2026-09-03", clienteId: "c-7", cliente: "Andrés Molina", vendedorId: "u-3", vendedor: "Meli", procedencia: "MercadoLibre", items: [{ detalle: "iPhone SE 2020 64GB", cantidad: 1, precioUsd: 195 }], totalUsd: 195, pagos: [{ medio: "dolares", montoUsd: 195 }], margenPct: 33.3, tipo: "venta" },
  { id: "V-4810", fecha: "Sáb 11:50", fechaISO: "2026-09-02", clienteId: "c-2", cliente: "Sofía Ramos", vendedorId: "u-2", vendedor: "Caro", procedencia: "Local", items: [{ detalle: "Cambio de pantalla iPhone XR", cantidad: 1, precioUsd: 75 }], totalUsd: 75, pagos: [{ medio: "transferencia", montoUsd: 75 }], margenPct: 28.0, tipo: "reparacion" },
];

// ───────────────────────── Cajas ─────────────────────────

// Caja USD: montos en dólares. Caja ARS: montos en pesos.
export const movimientosHoy: MovimientoCaja[] = [
  { id: "m-1", fecha: "07 sep", hora: "09:50", concepto: "Venta V-4820 — batería iPhone 12", medioPago: "transferencia", tipo: "ingreso", moneda: "usd", monto: 55 },
  { id: "m-2", fecha: "07 sep", hora: "10:30", concepto: "Compra repuestos — PartsAR", medioPago: "transferencia", tipo: "egreso", moneda: "usd", monto: 120 },
  { id: "m-3", fecha: "07 sep", hora: "11:15", concepto: "Seña reparación #229", medioPago: "pesos", tipo: "ingreso", moneda: "ars", monto: 29000 },
  { id: "m-4", fecha: "07 sep", hora: "12:40", concepto: "Almuerzo equipo (caja chica)", medioPago: "pesos", tipo: "egreso", moneda: "ars", monto: 26000 },
  { id: "m-5", fecha: "07 sep", hora: "14:20", concepto: "Venta V-4821 — iPhone 13", medioPago: "transferencia", tipo: "ingreso", moneda: "usd", monto: 735 },
  { id: "m-6", fecha: "07 sep", hora: "15:05", concepto: "iPhone 11 tomado como parte de pago", medioPago: "canje", tipo: "ingreso", moneda: "usd", monto: 300 },
  { id: "m-7", fecha: "07 sep", hora: "16:10", concepto: "Venta accesorios varios", medioPago: "tarjeta", tipo: "ingreso", moneda: "ars", monto: 44000 },
];

// Movimientos de días anteriores (para el historial completo).
export const movimientosPrevios: MovimientoCaja[] = [
  { id: "m-p1", fecha: "06 sep", hora: "18:40", concepto: "Venta V-4819 — iPhone 15 Pro", medioPago: "cripto", tipo: "ingreso", moneda: "usd", monto: 1240 },
  { id: "m-p2", fecha: "06 sep", hora: "17:10", concepto: "Venta V-4818 — accesorios", medioPago: "pesos", tipo: "ingreso", moneda: "ars", monto: 32000 },
  { id: "m-p3", fecha: "06 sep", hora: "12:00", concepto: "Pago proveedor Tecno Import", medioPago: "transferencia", tipo: "egreso", moneda: "usd", monto: 210 },
  { id: "m-p4", fecha: "06 sep", hora: "10:05", concepto: "Reparación V-4816 — pantalla 13", medioPago: "transferencia", tipo: "ingreso", moneda: "usd", monto: 90 },
  { id: "m-p5", fecha: "05 sep", hora: "16:30", concepto: "Venta iPhone 12 usado", medioPago: "dolares", tipo: "ingreso", moneda: "usd", monto: 520 },
  { id: "m-p6", fecha: "05 sep", hora: "11:20", concepto: "Compra fundas y vidrios", medioPago: "pesos", tipo: "egreso", moneda: "ars", monto: 117000 },
  { id: "m-p7", fecha: "04 sep", hora: "19:20", concepto: "Venta V-4815 — iPhone 13 mini", medioPago: "transferencia", tipo: "ingreso", moneda: "usd", monto: 600 },
  { id: "m-p8", fecha: "04 sep", hora: "15:40", concepto: "Reparación V-4814 — placa XR", medioPago: "pesos", tipo: "ingreso", moneda: "ars", monto: 234000 },
  { id: "m-p9", fecha: "04 sep", hora: "13:00", concepto: "Retiro socio", medioPago: "pesos", tipo: "egreso", moneda: "ars", monto: 293000 },
  { id: "m-p10", fecha: "03 sep", hora: "16:30", concepto: "Venta V-4812 — iPhone 14", medioPago: "cripto", tipo: "ingreso", moneda: "usd", monto: 860 },
  { id: "m-p11", fecha: "03 sep", hora: "13:15", concepto: "Venta V-4811 — iPhone SE", medioPago: "dolares", tipo: "ingreso", moneda: "usd", monto: 195 },
  { id: "m-p12", fecha: "02 sep", hora: "11:50", concepto: "Reparación V-4810 — pantalla XR", medioPago: "transferencia", tipo: "ingreso", moneda: "usd", monto: 75 },
  { id: "m-p13", fecha: "02 sep", hora: "10:00", concepto: "Compra insumos varios", medioPago: "pesos", tipo: "egreso", moneda: "ars", monto: 58000 },
];

export const movimientosTodos: MovimientoCaja[] = [
  ...movimientosHoy,
  ...movimientosPrevios,
];

export const cierresPrevios = [
  { fecha: "06 sep", ingresos: 1980, egresos: 340, neto: 1640, responsable: "Caro" },
  { fecha: "04 sep", ingresos: 1010, egresos: 210, neto: 800, responsable: "Meli" },
  { fecha: "03 sep", ingresos: 1250, egresos: 0, neto: 1250, responsable: "Fermín G." },
  { fecha: "02 sep", ingresos: 640, egresos: 95, neto: 545, responsable: "Caro" },
];

// ───────────────────────── Analíticas ─────────────────────────

export const margenPorTipo = [
  { tipo: "Venta de equipos", operaciones: 42, margenPct: 23.1, gananciaUsd: 6820 },
  { tipo: "Reparaciones", operaciones: 68, margenPct: 41.7, gananciaUsd: 3140 },
  { tipo: "Accesorios", operaciones: 55, margenPct: 52.0, gananciaUsd: 610 },
];

export const tiempoPorFalla = [
  { falla: "Cambio de pantalla", horas: 1.2, tickets: 24 },
  { falla: "Cambio de batería", horas: 0.6, tickets: 31 },
  { falla: "Pin de carga", horas: 0.9, tickets: 12 },
  { falla: "Reparación de placa", horas: 5.4, tickets: 9 },
  { falla: "Cámara", horas: 1.1, tickets: 7 },
  { falla: "Daño por líquido", horas: 6.8, tickets: 5 },
];

export const rendimientoTecnicos = [
  { tecnico: "Nico", cerrados: 48, reingresos: 2, ticketPromHoras: 2.1, calif: 4.8 },
  { tecnico: "Dani", cerrados: 34, reingresos: 1, ticketPromHoras: 1.7, calif: 4.9 },
];

export const ventasPorMes = [
  { mes: "Abr", usd: 38200 },
  { mes: "May", usd: 41100 },
  { mes: "Jun", usd: 44800 },
  { mes: "Jul", usd: 39900 },
  { mes: "Ago", usd: 52300 },
  { mes: "Sep", usd: 48250 },
];

// demografía de clientes por período (% del total)
export const clientesDemografia: Record<
  "historico" | "mes" | "semana",
  { rango: string; pct: number }[]
> = {
  historico: [
    { rango: "18–24", pct: 24 },
    { rango: "25–34", pct: 29 },
    { rango: "35–44", pct: 21 },
    { rango: "45–54", pct: 16 },
    { rango: "55+", pct: 10 },
  ],
  mes: [
    { rango: "18–24", pct: 27 },
    { rango: "25–34", pct: 31 },
    { rango: "35–44", pct: 19 },
    { rango: "45–54", pct: 14 },
    { rango: "55+", pct: 9 },
  ],
  semana: [
    { rango: "18–24", pct: 30 },
    { rango: "25–34", pct: 33 },
    { rango: "35–44", pct: 18 },
    { rango: "45–54", pct: 12 },
    { rango: "55+", pct: 7 },
  ],
};

// mix de rubros por período (valores ~ % de facturación)
export const ventasPorRubro: Record<
  "historico" | "mes" | "semana",
  { label: string; value: number }[]
> = {
  historico: [
    { label: "Equipos", value: 48 },
    { label: "Reparaciones", value: 31 },
    { label: "Accesorios", value: 13 },
    { label: "Otros", value: 8 },
  ],
  mes: [
    { label: "Equipos", value: 42 },
    { label: "Reparaciones", value: 35 },
    { label: "Accesorios", value: 15 },
    { label: "Otros", value: 8 },
  ],
  semana: [
    { label: "Equipos", value: 37 },
    { label: "Reparaciones", value: 41 },
    { label: "Accesorios", value: 12 },
    { label: "Otros", value: 10 },
  ],
};

// ───────────────────────── Configuración ─────────────────────────

export const negocio = {
  nombre: "Tekly — Sucursal Centro",
  direccion: "Av. Corrientes 1234, CABA",
  telefono: "+54 9 11 4000-1234",
  cuit: "30-71234567-9",
  horario: "Lun a Sáb, 10:00 a 19:00",
};

export const cotizacionHistorial = [
  { fecha: "07 sep", compra: 1445, venta: 1465 },
  { fecha: "06 sep", compra: 1440, venta: 1460 },
  { fecha: "05 sep", compra: 1430, venta: 1450 },
  { fecha: "04 sep", compra: 1435, venta: 1455 },
];

export const plantillasWhatsApp = [
  { id: "w-1", nombre: "Presupuesto listo", texto: "Hola {cliente}! Ya tenemos el diagnóstico de tu {equipo}. El presupuesto es de USD {monto}. ¿Lo aprobás?" },
  { id: "w-2", nombre: "Equipo listo para retirar", texto: "Hola {cliente}! Tu {equipo} ya está reparado y listo para retirar. Te esperamos en {direccion}." },
  { id: "w-3", nombre: "Recordatorio de turno", texto: "Hola {cliente}, te recordamos tu turno hoy a las {hora}. Cualquier cambio avisanos por acá." },
  { id: "w-4", nombre: "Esperando repuesto", texto: "Hola {cliente}, tu {equipo} está en espera de un repuesto que llega en 24-48hs. Te avisamos apenas esté." },
];
