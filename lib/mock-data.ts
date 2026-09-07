export const dashboardMetrics = [
  { key: "ventas", label: "Ventas del mes", value: "USD 48.250", delta: 12.4 },
  { key: "margen", label: "Margen promedio", value: "34,2 %", delta: 2.1 },
  { key: "abiertos", label: "Tickets abiertos", value: "17", delta: -8.0 },
  { key: "cerrados", label: "Tickets cerrados (mes)", value: "82", delta: 15.6 },
  { key: "revision", label: "Equipos en revisión", value: "9", delta: 4.0 },
];

// ventas diarias últimos 14 días (USD)
export const salesTrend = [
  1180, 1420, 980, 1650, 2100, 1750, 1320, 1890, 2450, 2010, 1670, 2380, 2760,
  3100,
];

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
  { id: "V-4821", cliente: "Juan Pérez", item: "iPhone 13 128GB", vendedor: "Caro", monto: 735, fecha: "Hoy 14:20" },
  { id: "V-4820", cliente: "Sofía Ramos", item: "Cambio de batería 12", vendedor: "Meli", monto: 55, fecha: "Hoy 12:05" },
  { id: "V-4819", cliente: "Marco Díaz", item: "iPhone 15 Pro 256GB", vendedor: "Caro", monto: 1240, fecha: "Ayer 18:40" },
  { id: "V-4818", cliente: "Lucía V.", item: "Vidrio templado + funda", vendedor: "Meli", monto: 22, fecha: "Ayer 17:10" },
  { id: "V-4817", cliente: "Diego F.", item: "iPhone 11 64GB", vendedor: "Caro", monto: 410, fecha: "Ayer 11:30" },
];
