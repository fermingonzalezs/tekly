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
  | "reservado"
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
  /** Opcional -- solo para "Demografía de clientes" en el dashboard de
   * Clientes. Un cliente sin esto queda afuera de ese cálculo. */
  fechaNacimiento?: string;
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
  fechaISO: string;
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
  /** Equipos de inventario vinculados (turnos de compra/retira). */
  equipoIds?: string[];
  /** Seña o pago tomado al agendar (turnos de compra/retira). */
  pagos?: Pago[];
  nota?: string;
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

/** Historial de stock de un ítem de inventario (equipo, repuesto u otro) —
 * ingreso, cambios de estado, ajustes, etc. */
export type Movimiento = {
  fecha: string;
  hora: string;
  detalle: string;
  usuario: string;
};

/** Unidad individual de un producto serializado de "Otros" — cada una con
 * su propio serial, color y costo (pueden entrar en distintas tandas). */
export type OtroUnidad = {
  serial: string;
  color?: string;
  costoUsd: number;
};

/** Productos que no son iPhones ni repuestos: iPad, AirPods, tablets, etc. */
export type OtroItem = {
  id: string;
  nombre: string;
  descripcion?: string;
  categoria: OtroCategoria;
  precioUsd: number;
} & (
  | { serializado: true; unidades: OtroUnidad[] }
  | { serializado: false; cantidad: number; costoUsd: number }
);

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

/** Un medio de pago con su monto (pago simple o dividido) y la caja a la
 * que ingresa (`caja` = misma moneda que usa `MovimientoCaja`). */
export type Pago = {
  medio: MedioPago;
  montoUsd: number;
  caja: "usd" | "ars";
};

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

/** Caja física/específica — puede haber varias por moneda (ej. "Mostrador"
 * y "Taller" en ARS, "Caja USD" y "Bóveda USD" en USD). */
export type Caja = {
  id: string;
  nombre: string;
  moneda: "usd" | "ars";
  /** Cajas desactivadas no aparecen para cargar movimientos nuevos, pero
   * conservan su historial. */
  activa: boolean;
  descripcion: string;
  /** "mar 2023" — igual formato que `Cliente.desde`. */
  creadaEl: string;
  /** Medio de pago fijo de esta caja — al elegir la caja en un movimiento
   * nuevo, el medio de pago se completa solo, no se vuelve a preguntar. */
  medioPago: MedioPago;
};

export type MovimientoCaja = {
  id: string;
  fecha: string; // "07 sep"
  hora: string;
  concepto: string;
  medioPago: MedioPago;
  tipo: "ingreso" | "egreso";
  /** Caja específica a la que pertenece; `monto` está en la moneda de esa caja. */
  cajaId: string;
  monto: number;
  /** Quién lo cargó — manual o generado automático desde una venta/pago. */
  usuario: string;
};

/** Una línea de conciliación: lo que el sistema esperaba tener en una caja
 * (neto de movimientos desde la última conciliación) vs. lo contado a mano. */
export type ConciliacionLinea = {
  cajaId: string;
  /** Neto acumulado en `movimientos` para esta caja desde la última conciliación. */
  montoSistema: number;
  /** Lo que se contó físicamente. */
  montoReal: number;
  comentario: string;
};

export type Conciliacion = {
  id: string;
  fecha: string;
  hora: string;
  responsable: string;
  lineas: ConciliacionLinea[];
};

/** Movimiento de cuenta corriente ("fiado") de un cliente — `cargo` aumenta
 * la deuda, `pago` la reduce. Siempre en USD, como el resto de la app. */
export type MovimientoCC = {
  id: string;
  clienteId: string;
  fecha: string;
  hora: string;
  concepto: string;
  tipo: "cargo" | "pago";
  montoUsd: number;
  usuario: string;
};

export type CompraEstado = "pendiente" | "recibida";

export type CompraItem = {
  detalle: string;
  cantidad: number;
  costoUsd: number;
};

/** Compra a proveedor — el espejo de `Venta` del lado del gasto. */
export type Compra = {
  id: string;
  fecha: string;
  fechaISO: string;
  proveedor: string;
  items: CompraItem[];
  totalUsd: number;
  medioPago: MedioPago;
  estado: CompraEstado;
  /** Cuando `medioPago` es "pesos": el monto realmente pagado en ARS y la
   * cotización del dólar blue usada para convertirlo a `totalUsd` — se
   * guarda el tipo de cambio del momento en vez de recalcularlo con el
   * valor actual, para que el registro histórico no cambie con el tiempo. */
  montoArs?: number;
  cotizacion?: number;
};

/** Regla que trae TODOS los equipos vendibles (disponible/aprobado p/venta)
 * de una o más condiciones — ej. "A+, A" para armar una sección de gama
 * alta. Vacío = todas las condiciones. Se evalúa contra el stock actual
 * cada vez que se genera el mensaje: agregar la regla una vez alcanza,
 * no hay que volver a seleccionar equipo por equipo. */
export type DifusionReglaEquipo = {
  id: string;
  tipo: "equipo";
  condiciones: string[];
};

/** Regla que trae todos los productos de "Otros" de una categoría — ej.
 * todas las tablets. Igual de reusable que la de equipos. */
export type DifusionReglaOtro = {
  id: string;
  tipo: "otro";
  categoria: OtroCategoria;
};

/** Línea suelta sin origen en el inventario — el único caso donde precio y
 * costo se cargan a mano, porque no hay de dónde sacarlos automáticamente. */
export type DifusionManual = {
  id: string;
  tipo: "manual";
  texto: string;
  precioUsd: number;
  costoUsd?: number;
};

export type DifusionEntrada = DifusionReglaEquipo | DifusionReglaOtro | DifusionManual;

/** Un grupo con encabezado propio dentro del mensaje, ej. "IPHONE USADOS". */
export type DifusionSeccion = {
  id: string;
  nombre: string;
  /** Emoji que antecede a cada ítem de esta sección. */
  emoji: string;
  entradas: DifusionEntrada[];
};

/** Catálogo de productos armado para copiar y pegar en WhatsApp u otro
 * medio — no es una lista de contactos, es la plantilla del mensaje. */
export type ListaDifusion = {
  id: string;
  nombre: string;
  mensajeInicial: string;
  mensajeFinal: string;
  descuentoTipo: "ninguno" | "monto" | "porcentaje";
  /** USD si `descuentoTipo` es "monto"; % si es "porcentaje". */
  descuentoValor: number;
  secciones: DifusionSeccion[];
  creadaEl: string;
};
