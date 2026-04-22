// ── Auth ──────────────────────────────────────────────────────────────────

export interface LoginDto {
  email: string
  password: string
  deviceToken?: string
}

/** Permisos efectivos del usuario (rol + overrides ya fusionados — todos boolean, no nullable) */
export interface PermisosEfectivos {
  puedeGestionarProductos:   boolean
  puedeCrearVentas:          boolean
  puedeVerTodasVentas:       boolean
  puedeEditarVentas:         boolean
  puedeAprobarVentas:        boolean
  puedeAnularVentas:         boolean
  puedeGestionarClientes:    boolean
  puedeVerClientes:          boolean
  puedeGestionarCreditos:    boolean
  puedeRegistrarPagos:       boolean
  puedeVerReportes:          boolean
  puedeVerStockBajo:         boolean
  puedeGestionarUsuarios:    boolean
  puedeVerDashboard:         boolean
  tieneAccesoProductos:      boolean
  puedeGestionarCaja:        boolean
  puedeGestionarComprobantes: boolean
  puedeGestionarEmpleados:   boolean
}

/** Overrides explícitos por usuario. null = usar default del rol */
export interface PermisosUsuario {
  puedeGestionarProductos?:   boolean | null
  puedeCrearVentas?:          boolean | null
  puedeVerTodasVentas?:       boolean | null
  puedeEditarVentas?:         boolean | null
  puedeAprobarVentas?:        boolean | null
  puedeAnularVentas?:         boolean | null
  puedeGestionarClientes?:    boolean | null
  puedeVerClientes?:          boolean | null
  puedeGestionarCreditos?:    boolean | null
  puedeRegistrarPagos?:       boolean | null
  puedeVerReportes?:          boolean | null
  puedeVerStockBajo?:         boolean | null
  puedeGestionarUsuarios?:    boolean | null
  puedeVerDashboard?:         boolean | null
  tieneAccesoProductos?:      boolean | null
  puedeGestionarCaja?:        boolean | null
  puedeGestionarComprobantes?: boolean | null
  puedeGestionarEmpleados?:   boolean | null
}

/** Permisos de un rol completo (no nullable) */
export interface PermisosRol extends PermisosEfectivos {
  rol: string
}

// Estructura real que devuelve el backend
export interface AuthResponse {
  token: string
  expiracion: string
  usuario: {
    id: number
    nombre: string
    email: string
    rol: string
    permisos: PermisosEfectivos
    twoFactorEnabled: boolean
    twoFactorMethod?: 'totp' | 'email'
  }
}

// Respuesta cuando el login requiere 2FA
export interface TwoFactorChallenge {
  requiresTwoFactor: true
  twoFactorKey: string
  method: 'totp' | 'email'
}

// Lo que guardamos en el contexto
export interface AuthUser {
  id: number
  nombre: string
  email: string
  rol: string
  token: string
  permisos: PermisosEfectivos
  twoFactorEnabled: boolean
  twoFactorMethod?: 'totp' | 'email'
}

// ── Categorías ────────────────────────────────────────────────────────────

export interface CategoriaResponse {
  id: number
  nombre: string
  totalProductos: number
}

export interface CreateCategoriaDto {
  nombre: string
}

// ── Productos ─────────────────────────────────────────────────────────────

export type TipoProducto = 'Fisico' | 'Servicio'
export type UnidadMedida = string

export interface ProductoResponse {
  id: number
  nombre: string
  descripcion?: string
  tipo: TipoProducto
  esMedible: boolean
  codigoBarra?: string
  contenido?: number
  unidadMedida: UnidadMedida
  presentacion: string
  precio: number
  precioMayorista?: number
  precioCosto?: number
  stock: number
  stockMinimo: number
  aplicaImpuesto: boolean
  porcentajeImpuesto: number
  categoriaId: number
  nombreCategoria: string
  activo: boolean
}

export interface CreateProductoDto {
  nombre: string
  descripcion?: string
  tipo: TipoProducto
  esMedible: boolean
  codigoBarra?: string
  contenido?: number
  unidadMedida: UnidadMedida
  precio: number
  precioMayorista?: number
  precioCosto?: number
  stock: number
  stockMinimo: number
  aplicaImpuesto: boolean
  porcentajeImpuesto: number
  categoriaId: number
}

export interface UpdateProductoDto extends CreateProductoDto {
  activo: boolean
}

export interface UnidadMedidaOption {
  valor: string
  etiqueta: string
  grupo: string
}

// ── Ventas ────────────────────────────────────────────────────────────────

export type TipoPago = 'Contado' | 'Credito'
export type EstadoVenta = 'Completada' | 'Pendiente' | 'Cancelada' | 'Devuelta'

export interface DetalleVentaResponse {
  id: number
  productoId: number
  nombreProducto: string
  tipoProducto: TipoProducto
  cantidad: number
  unidadMedida: string
  precioConImpuesto: number
  aplicaImpuesto: boolean
  porcentajeImpuesto: number
  precioBase: number
  montoImpuesto: number
  subtotalConImpuesto: number
  subtotalBase: number
  costoUnitario: number
  costoTotal: number
}

export interface VentaResponse {
  id: number
  usuarioId: number
  nombreUsuario: string
  clienteId?: number
  nombreCliente?: string
  cedulaCliente?: string
  tipoPago: TipoPago
  fechaVenta: string
  subtotalBase: number
  totalImpuesto: number
  descuento: number
  total: number
  totalDevuelto: number       // suma de devoluciones; 0 si no hay
  estado: EstadoVenta
  esMayorista: boolean
  tipoComprobanteId?: number
  codigoComprobante?: string
  nombreComprobante?: string
  aplicaItbisComprobante: boolean
  ncf?: string
  ncfValidado: boolean
  detalles: DetalleVentaResponse[]
}

export interface CreateDetalleDto {
  productoId: number
  cantidad: number
}

export interface CreateVentaDto {
  items: CreateDetalleDto[]
  descuento: number
  tipoPago: TipoPago
  clienteId?: number
  fechaVencimientoCredito?: string
  esMayorista: boolean
  tipoComprobanteId?: number
  ncf?: string
  /** NCF pre-reservado desde el carrito (tipo B). Evita doble reserva concurrente. */
  ncfSecuenciaId?: number
}

// ── NCF Pool + Devoluciones ──────────────────────────────────────────────────

export interface NcfReservadoResponse {
  ncfSecuenciaId: number
  ncf: string
  tipoComprobanteId: number
  codigoComprobante: string
}

export interface NcfSecuenciaResponse {
  id: number
  tipoComprobanteId: number
  codigoComprobante: string
  ncf: string
  estado: 'Disponible' | 'Reservado' | 'Usado' | 'Anulado'
  ventaId?: number
  fechaCarga: string
  fechaUso?: string
}

export interface NcfProximoResponse {
  ncf: string
  tipoComprobanteId: number
  codigoComprobante: string
  disponibles: number
}

export interface NcfPoolResumenResponse {
  tipoComprobanteId: number
  codigoComprobante: string
  disponibles: number
  reservados: number
  usados: number
  anulados: number
}

export interface CargarNcfLoteDto {
  tipoComprobanteId: number
  desde: number
  hasta: number
}

export interface NcfLoteCreadoResponse {
  creados: number
  omitidos: number
  desde: string
  hasta: string
}

export interface DetalleDevolucionResponse {
  id: number
  detalleVentaId: number
  productoId: number
  nombreProducto: string
  unidadMedida: string
  cantidadDevuelta: number
  precioConImpuesto: number
  precioBase: number
  subtotal: number
}

export interface DevolucionResponse {
  id: number
  ventaOriginalId: number
  nombreUsuario: string
  fechaDevolucion: string
  motivo: string
  estado: 'Completada' | 'PendienteComprobanteE'
  tipo: 'Completa' | 'Parcial'
  totalDevuelto: number
  tipoComprobanteId?: number
  codigoComprobante?: string
  ncf?: string
  detalles: DetalleDevolucionResponse[]
}

export interface CreateDetalleDevolucionDto {
  detalleVentaId: number
  cantidad: number
}

export interface CreateDevolucionDto {
  motivo: string
  tipo: 'Completa' | 'Parcial'
  items?: CreateDetalleDevolucionDto[]
}

// ── Caja ──────────────────────────────────────────────────────────────────────

export interface CajaSessionResponse {
  id: number
  usuarioId: number
  nombreUsuario: string
  fechaApertura: string
  montoApertura: number
  observacionesApertura?: string
  fechaCierre?: string
  montoContado?: number
  totalVentasContado?: number
  totalVentasCredito?: number
  totalGeneral?: number
  montoEsperado?: number
  diferencia?: number
  totalFacturas?: number
  observacionesCierre?: string
  estado: 'Abierta' | 'Cerrada'
  /** null = no configurada, true = validación activa, false = validación desactivada */
  validacionAdmin?: boolean | null
  observacionValidacion?: string
  fechaValidacion?: string
  nombreValidadoPor?: string
}

export interface AbrirCajaDto {
  montoApertura: number
  observaciones?: string
}

export interface CerrarCajaDto {
  montoContado: number
  observaciones?: string
}

export interface ValidarCajaDto {
  valida: boolean
  observacion?: string
}

// ── Comprobantes ───────────────────────────────────────────────────────────

export interface TipoComprobanteResponse {
  id: number
  codigo: string
  nombre: string
  descripcion?: string
  requiereNcf: boolean
  aplicaItbis: boolean
  activo: boolean
}

export interface CreateTipoComprobanteDto {
  codigo: string
  nombre: string
  descripcion?: string
  requiereNcf: boolean
  aplicaItbis: boolean
}

export interface UpdateTipoComprobanteDto extends CreateTipoComprobanteDto {
  activo: boolean
}

export interface ValidarNcfResponse {
  valido: boolean
  ncf: string
  estado: string
  mensaje?: string
  rncEmisor?: string
  nombreEmisor?: string
  simulado: boolean
}

// ── Clientes ──────────────────────────────────────────────────────────────

export interface ClienteResponse {
  id: number
  nombre: string
  telefono?: string
  cedula?: string
  email?: string
  direccion?: string
  activo: boolean
  esMayorista: boolean
  porcentajeDescuento: number
  totalDeuda: number
  creditosActivos: number
  tipoComprobanteId?: number
  nombreComprobante?: string
}

export interface CreateClienteDto {
  nombre: string
  telefono?: string
  cedula?: string
  email?: string
  direccion?: string
  esMayorista: boolean
  porcentajeDescuento: number
  tipoComprobanteId: number
}

export interface UpdateClienteDto extends CreateClienteDto {
  activo: boolean
}

// ── Créditos ──────────────────────────────────────────────────────────────

export type EstadoCredito = 'Pendiente' | 'PagadoParcial' | 'Saldado' | 'Vencido' | 'Cancelado'

export interface PagoCreditoResponse {
  id: number
  monto: number
  fechaPago: string
  observacion?: string
  nombreUsuario: string
}

export interface CreditoResponse {
  id: number
  clienteId: number
  nombreCliente: string
  ventaId: number
  montoTotal: number
  montoPagado: number
  saldo: number
  fechaCreacion: string
  fechaVencimiento?: string
  estado: EstadoCredito
  pagos: PagoCreditoResponse[]
}

export interface ResumenCreditos {
  totalDeuda: number
  totalCobrado: number
  cantidadClientes: number
  creditosPendientes: number
  creditosPagadoParcial: number
  creditosVencidos: number
  creditosSaldados: number
}

export interface CreatePagoDto {
  monto: number
  observacion?: string
}

// ── Roles ─────────────────────────────────────────────────────────────────

export interface RolDefinicion {
  nombre: string
  label: string
  color: string
  esSistema: boolean
  rolBase: string | null
}

export interface CreateRolDto {
  nombre: string
  label: string
  rolBase: string
  color: string
}

export interface UpdateRolDto {
  label: string
  color: string
}

// ── Usuarios ──────────────────────────────────────────────────────────────

export interface UpdatePerfilDto {
  nombre: string
  email: string
}

export interface RegisterUsuarioDto {
  nombre: string
  email: string
  password: string
  rol: string
}

export interface UsuarioResponse {
  id: number
  nombre: string
  email: string
  rol: string
  fechaCreacion: string
  activo: boolean
  tieneResetPendiente: boolean
}

// ── Reportes ──────────────────────────────────────────────────────────────

export interface ReporteVentas {
  desde: string
  hasta: string
  totalVentas: number
  ventasContado: number
  ventasCredito: number
  ventasAnuladas: number
  montoTotal: number
  subtotalBase: number
  totalImpuesto: number
  totalDescuentos: number
  porDia: { fecha: string; cantidad: number; total: number }[]
}

export interface ReporteItbis {
  desde: string
  hasta: string
  totalItbis: number
  totalBaseGravada: number
  totalBaseExenta: number
  porProducto: {
    nombreProducto: string
    cantidadVendida: number
    baseImponible: number
    impuesto: number
    totalVendido: number
  }[]
}

export interface ProductoMasVendido {
  productoId: number
  nombre: string
  tipo: TipoProducto
  unidadMedida: string
  cantidadVendida: number
  numVentas: number
  totalIngresado: number
  costoTotal: number
  margenBruto: number
  porcentajeMargen: number
}

export interface ReporteRentabilidad {
  desde: string
  hasta: string
  totalVentas: number
  ingresosBrutos: number
  totalImpuestos: number
  totalDescuentos: number
  ingresoNeto: number
  promedioVenta: number
  costoTotal: number
  gananciaBruta: number
  porcentajeMargen: number
  tieneCostos: boolean
}

// ── Cotizaciones ──────────────────────────────────────────────────────────

export interface CotizacionDetalleResponse {
  id:             number
  productoId:     number
  nombreProducto: string
  unidadMedida:   string
  precio:         number
  cantidad:       number
  subtotal:       number
}

export interface CotizacionResponse {
  id:               number
  fechaCreacion:    string
  fechaVencimiento: string
  clienteId?:       number
  nombreCliente?:   string
  descuento:        number
  subtotal:         number
  total:            number
  estado:           'Vigente' | 'Concretada' | 'Cancelada' | 'Vencida'
  diasRestantes:    number
  usuarioId:        number
  nombreUsuario:    string
  ventaId?:         number
  detalles:         CotizacionDetalleResponse[]
}

export interface CreateCotizacionDetalleDto {
  productoId:     number
  nombreProducto: string
  unidadMedida:   string
  precio:         number
  cantidad:       number
}

export interface CreateCotizacionDto {
  clienteId?:  number
  descuento:   number
  validezDias: number
  detalles:    CreateCotizacionDetalleDto[]
}

// ── Empleados ─────────────────────────────────────────────────────────────

export interface EmpleadoListDto {
  id:              number
  nombre:          string
  posicion?:       string
  departamento?:   string
  salario?:        number
  vacacionesDias?: number
  fechaCumpleanos?: string   // DateOnly → "YYYY-MM-DD"
  usuarioId?:      number
  nombreUsuario?:  string
  activo:          boolean
}

export interface EmpleadoDetailDto extends EmpleadoListDto {
  direccion?:    string
  emailUsuario?: string
  fechaCreacion: string
}

export interface SaveEmpleadoDto {
  nombre:          string
  posicion?:       string
  departamento?:   string
  salario?:        number | null
  direccion?:      string
  vacacionesDias?: number | null
  fechaCumpleanos?: string | null  // "YYYY-MM-DD"
  usuarioId?:      number | null
  activo:          boolean
}

export interface UsuarioOpcionDto {
  id:     number
  nombre: string
  email:  string
}
