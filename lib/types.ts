export type Role = "admin" | "vendedor" | "tecnico";

export type TicketStatus =
  | "recibido"
  | "diagnosticado"
  | "presupuestado"
  | "aprobado"
  | "en_reparacion"
  | "esperando_repuesto"
  | "listo"
  | "entregado";

export type EquipoStatus =
  | "en_revision"
  | "aprobado_para_venta"
  | "disponible"
  | "vendido";

export type MedioPago =
  | "pesos"
  | "dolares"
  | "transferencia"
  | "cripto"
  | "tarjeta"
  | "canje";

export type TurnoEstado = "pendiente" | "confirmado" | "llego" | "cancelado";

/** Qué viene a hacer el cliente — define el color en el calendario. */
export type TurnoTipo = "compra" | "deja" | "retira" | "cotizar";

export type OtroCategoria =
  | "ipad"
  | "airpods"
  | "tablet"
  | "accesorio"
  | "otro";

export type Usuario = {
  id: string;
  nombre: string;
  alias: string;
  rol: Role;
  email: string;
  activo: boolean;
};

export type Cliente = {
  id: string;
  nombre: string;
  telefono: string;
  email: string;
  desde: string;
  compras: number;
  reparaciones: number;
  gastadoUsd: number;
};

export type Servicio = {
  id: string;
  nombre: string;
  precioUsd: number;
  garantiaDias: number;
  activo: boolean;
};

export type TicketServicio = {
  servicioId: string;
  nombre: string;
  precioUsd: number;
};

export type Ticket = {
  id: number;
  clienteId: string;
  cliente: string;
  equipo: string;
  imei: string;
  falla: string;
  tecnicoId: string | null;
  tecnico: string | null;
  estado: TicketStatus;
  ingreso: string;
  presupuestoUsd: number;
  servicios: TicketServicio[];
  nota?: string;
};

export type Turno = {
  id: string;
  /** 0 = hoy … 6 = dentro de una semana. */
  dayOffset: number;
  hora: string; // "HH:00", entre 09:00 y 20:00
  cliente: string;
  tipo: TurnoTipo;
  estado: TurnoEstado;
  ticketId: number | null;
};

export type Equipo = {
  id: string;
  modelo: string;
  almacenamiento: string;
  color: string;
  imei: string;
  bateria: number;
  condicion: string;
  costoUsd: number;
  precioUsd: number;
  estado: EquipoStatus;
};

/** Productos que no son iPhones ni repuestos: iPad, AirPods, tablets, etc. */
export type OtroItem = {
  id: string;
  nombre: string;
  categoria: OtroCategoria;
  cantidad: number;
  costoUsd: number;
  precioUsd: number;
};

export type Repuesto = {
  id: string;
  sku: string;
  nombre: string;
  modelo: string;
  stock: number;
  stockMin: number;
  costoUsd: number;
  proveedor: string;
};

export type Proveedor = {
  id: string;
  nombre: string;
  contacto: string;
  telefono: string;
  rubro: string;
  ubicacion: string;
  repuestos: number;
};

export type VentaItem = {
  detalle: string;
  cantidad: number;
  precioUsd: number;
  costoUsd?: number;
  /** Si el ítem sale del inventario de equipos. */
  equipoId?: string;
};

/** Un medio de pago con su monto (pago simple o dividido). */
export type Pago = { medio: MedioPago; montoUsd: number };

export type Venta = {
  id: string;
  fecha: string;
  fechaISO: string;
  clienteId: string;
  cliente: string;
  vendedorId: string;
  vendedor: string;
  /** Canal / origen de la venta (Local, WhatsApp, Instagram, …). */
  procedencia?: string;
  items: VentaItem[];
  totalUsd: number;
  /** 1+ medios con monto; la suma cubre el total. */
  pagos: Pago[];
  margenPct: number;
  tipo: "venta" | "reparacion";
};

export type MovimientoCaja = {
  id: string;
  fecha: string; // "07 sep"
  hora: string;
  concepto: string;
  medioPago: MedioPago;
  tipo: "ingreso" | "egreso";
  /** Caja a la que pertenece; `monto` está en esta moneda. */
  moneda: "usd" | "ars";
  monto: number;
};
