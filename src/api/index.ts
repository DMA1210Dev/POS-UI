import api from '../lib/axios'
import type {
  LoginDto, AuthResponse, TwoFactorChallenge, PermisosUsuario, PermisosRol,
  CategoriaResponse, CreateCategoriaDto,
  ProductoResponse, CreateProductoDto, UpdateProductoDto, UnidadMedidaOption,
  VentaResponse, CreateVentaDto,
  ClienteResponse, CreateClienteDto, UpdateClienteDto,
  CreditoResponse, ResumenCreditos, CreatePagoDto,
  UsuarioResponse, RegisterUsuarioDto, UpdatePerfilDto,
  ReporteVentas, ReporteItbis, ProductoMasVendido, ReporteRentabilidad,
  TipoComprobanteResponse, CreateTipoComprobanteDto, UpdateTipoComprobanteDto, ValidarNcfResponse,
  NcfSecuenciaResponse, NcfProximoResponse, NcfPoolResumenResponse,
  CargarNcfLoteDto, NcfLoteCreadoResponse, NcfReservadoResponse,
  DevolucionResponse, CreateDevolucionDto,
  CajaSessionResponse, AbrirCajaDto, CerrarCajaDto, ValidarCajaDto,
  CotizacionResponse, CreateCotizacionDto,
  RolDefinicion, CreateRolDto, UpdateRolDto,
} from '../types'

// ── Comercio ──────────────────────────────────────────────────────────────
export interface ComercioResponse {
  id: number
  nombre: string
  slogan?: string
  telefono?: string
  direccion?: string
  rnc?: string
  facturacionElectronicaHabilitada: boolean
  permitirVentaSinComprobante: boolean
  permitirVentaSinCliente: boolean
  permitirAutoAprobacion: boolean
  rolesAprobadores: string[]
  rolesMayoristas: string[]
  permitirCajaChica: boolean
  camaraHabilitada: boolean
  logoUrl?: string
  logoTagUrl?: string
  colorMenu: string
  colorMenuFin: string
  colorLogin: string
  colorLoginFin: string
  smtpHost?: string
  smtpPort?: number
  smtpUseSsl: boolean
  smtpUsername?: string
  smtpFromName?: string
  smtpConfigurado: boolean
}
export interface UpdateComercioDto {
  nombre: string
  slogan?: string
  telefono?: string
  direccion?: string
  rnc?: string
  facturacionElectronicaHabilitada: boolean
  permitirVentaSinComprobante: boolean
  permitirVentaSinCliente: boolean
  permitirAutoAprobacion: boolean
  rolesAprobadores: string[]
  rolesMayoristas: string[]
  permitirCajaChica: boolean
  colorMenu: string
  colorMenuFin: string
  colorLogin: string
  colorLoginFin: string
  smtpHost?: string
  smtpPort?: number
  smtpUseSsl: boolean
  smtpUsername?: string
  smtpPassword?: string
  smtpFromName?: string
}
export const comercioApi = {
  get: () =>
    api.get<ComercioResponse>('/comercio').then(r => r.data),
  update: (dto: UpdateComercioDto) =>
    api.put<ComercioResponse>('/comercio', dto).then(r => r.data),
  uploadLogo: (file: File) => {
    const form = new FormData()
    form.append('archivo', file)
    return api.post<ComercioResponse>('/comercio/logo', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },
  deleteLogo: () =>
    api.delete<ComercioResponse>('/comercio/logo').then(r => r.data),
  uploadLogoTag: (file: File) => {
    const form = new FormData()
    form.append('archivo', file)
    return api.post<ComercioResponse>('/comercio/logo-tag', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },
  deleteLogoTag: () =>
    api.delete<ComercioResponse>('/comercio/logo-tag').then(r => r.data),
  probarSmtp: (destinatario: string) =>
    api.post<{ mensaje: string }>('/comercio/probar-smtp', { destinatario }).then(r => r.data),
}

// ── Roles ─────────────────────────────────────────────────────────────────
export const rolesApi = {
  getAll: () =>
    api.get<RolDefinicion[]>('/roles').then(r => r.data),
  create: (dto: CreateRolDto) =>
    api.post<RolDefinicion>('/roles', dto).then(r => r.data),
  update: (nombre: string, dto: UpdateRolDto) =>
    api.put<RolDefinicion>(`/roles/${nombre}`, dto).then(r => r.data),
  delete: (nombre: string) =>
    api.delete(`/roles/${nombre}`),
}

// ── Auth ──────────────────────────────────────────────────────────────────
// ── Auth ──────────────────────────────────────────────────────────────────
export const authApi = {
  login: (dto: LoginDto) =>
    api.post<AuthResponse | TwoFactorChallenge>('/auth/login', dto).then(r => r.data),

  me: () =>
    api.get<AuthResponse>('/auth/me').then(r => r.data),

  solicitarReset: (email: string) =>
    api
      .post<{ mensaje: string; hasTwoFactor: boolean; twoFactorMethod?: string }>(
        '/auth/solicitar-reset',
        { email }
      )
      .then(r => r.data),

  confirmarReset: (dto: {
    email: string
    codigo?: string
    nuevoPassword: string
    confirmarPassword: string
    codigoTwoFactor?: string
  }) =>
    api.post('/auth/confirmar-reset', dto).then(r => r.data),

  enviarCodigo2faReset: (email: string) =>
    api.post<{ mensaje: string }>('/auth/enviar-codigo-2fa-reset', { email }).then(r => r.data),
}

// ── 2FA ───────────────────────────────────────────────────────────────────
export interface TwoFactorVerifyResponse extends AuthResponse {
  deviceToken?: string
}
export const twoFactorApi = {
  setupTotp:  () =>
    api.get<{ qrCodeBase64: string; secret: string }>('/auth/2fa/setup/totp').then(r => r.data),
  setupEmail: () =>
    api.get<{ mensaje: string }>('/auth/2fa/setup/email').then(r => r.data),
  enable: (codigo: string) =>
    api.post<{ mensaje: string }>('/auth/2fa/enable', { codigo }).then(r => r.data),
  disable: (password: string) =>
    api.delete<{ mensaje: string }>('/auth/2fa', { data: { password } }).then(r => r.data),
  verify: (dto: { twoFactorKey: string; codigo: string; recordarEquipo: boolean; nombreEquipo: string }) =>
    api.post<TwoFactorVerifyResponse>('/auth/2fa/verify', dto).then(r => r.data),
  sendCode: (twoFactorKey: string) =>
    api.post<{ mensaje: string }>('/auth/2fa/send-code', { twoFactorKey }).then(r => r.data),
}

// ── Categorías ────────────────────────────────────────────────────────────
export const categoriasApi = {
  getAll: () =>
    api.get<CategoriaResponse[]>('/categorias').then(r => r.data),
  create: (dto: CreateCategoriaDto) =>
    api.post<CategoriaResponse>('/categorias', dto).then(r => r.data),
  update: (id: number, dto: CreateCategoriaDto) =>
    api.put<CategoriaResponse>(`/categorias/${id}`, dto).then(r => r.data),
  delete: (id: number) =>
    api.delete(`/categorias/${id}`),
}

// ── Productos ─────────────────────────────────────────────────────────────
export const productosApi = {
  getAll: (params?: { search?: string; categoriaId?: number; tipo?: string; soloActivos?: boolean }) =>
    api.get<ProductoResponse[]>('/productos', { params }).then(r => r.data),
  stockBajo: () =>
    api.get<ProductoResponse[]>('/productos/stock-bajo').then(r => r.data),
  getById: (id: number) =>
    api.get<ProductoResponse>(`/productos/${id}`).then(r => r.data),
  create: (dto: CreateProductoDto) =>
    api.post<ProductoResponse>('/productos', dto).then(r => r.data),
  update: (id: number, dto: UpdateProductoDto) =>
    api.put<ProductoResponse>(`/productos/${id}`, dto).then(r => r.data),
  delete: (id: number) =>
    api.delete(`/productos/${id}`),
  unidades: () =>
    api.get<UnidadMedidaOption[]>('/UnidadesMedida').then(r => r.data),
  adjustStock: (id: number, stock: number) =>
    api.patch<ProductoResponse>(`/productos/${id}/stock`, { stock }).then(r => r.data),
}

// ── Ventas ────────────────────────────────────────────────────────────────
export const ventasApi = {
  getAll: (params?: { desde?: string; hasta?: string; tipoPago?: string; usuarioId?: number }) =>
    api.get<VentaResponse[]>('/ventas', { params }).then(r => r.data),
  misVentas: () =>
    api.get<VentaResponse[]>('/ventas/mis-ventas').then(r => r.data),
  getById: (id: number) =>
    api.get<VentaResponse>(`/ventas/${id}`).then(r => r.data),
  create: (dto: CreateVentaDto) =>
    api.post<VentaResponse>('/ventas', dto).then(r => r.data),
  update: (id: number, dto: CreateVentaDto) =>
    api.put<VentaResponse>(`/ventas/${id}`, dto).then(r => r.data),
  aprobar: (id: number) =>
    api.post<VentaResponse>(`/ventas/${id}/aprobar`).then(r => r.data),
  anular: (id: number) =>
    api.delete<VentaResponse>(`/ventas/${id}`).then(r => r.data),
  devolver: (id: number, dto: CreateDevolucionDto) =>
    api.post<DevolucionResponse>(`/ventas/${id}/devolucion`, dto).then(r => r.data),
  getDevoluciones: (params?: { desde?: string; hasta?: string }) =>
    api.get<DevolucionResponse[]>('/ventas/devoluciones', { params }).then(r => r.data),
}

// ── Clientes ──────────────────────────────────────────────────────────────
export const clientesApi = {
  getAll: (params?: { search?: string; soloConDeuda?: boolean; esMayorista?: boolean }) =>
    api.get<ClienteResponse[]>('/clientes', { params }).then(r => r.data),
  getById: (id: number) =>
    api.get<ClienteResponse>(`/clientes/${id}`).then(r => r.data),
  create: (dto: CreateClienteDto) =>
    api.post<ClienteResponse>('/clientes', dto).then(r => r.data),
  update: (id: number, dto: UpdateClienteDto) =>
    api.put<ClienteResponse>(`/clientes/${id}`, dto).then(r => r.data),
  delete: (id: number) =>
    api.delete(`/clientes/${id}`),
}

// ── Créditos ──────────────────────────────────────────────────────────────
export const creditosApi = {
  getAll: () =>
    api.get<CreditoResponse[]>('/creditos').then(r => r.data),
  resumen: () =>
    api.get<ResumenCreditos>('/creditos/resumen').then(r => r.data),
  porCliente: (clienteId: number) =>
    api.get<CreditoResponse[]>(`/creditos/cliente/${clienteId}`).then(r => r.data),
  getById: (id: number) =>
    api.get<CreditoResponse>(`/creditos/${id}`).then(r => r.data),
  registrarPago: (id: number, dto: CreatePagoDto) =>
    api.post<CreditoResponse>(`/creditos/${id}/pagos`, dto).then(r => r.data),
  actualizarVencidos: () =>
    api.put('/creditos/actualizar-vencidos').then(r => r.data),
}

// ── Usuarios ──────────────────────────────────────────────────────────────
export const usuariosApi = {
  getAll: () =>
    api.get<UsuarioResponse[]>('/usuarios').then(r => r.data),
  getById: (id: number) =>
    api.get<UsuarioResponse>(`/usuarios/${id}`).then(r => r.data),
  create: (dto: RegisterUsuarioDto) =>
    api.post<UsuarioResponse>('/auth/register', dto).then(r => r.data),
  updatePerfil: (dto: UpdatePerfilDto) =>
    api.put<UsuarioResponse>('/usuarios/perfil', dto).then(r => r.data),
  update: (id: number, dto: { nombre: string; rol: string; activo: boolean }) =>
    api.put<UsuarioResponse>(`/usuarios/${id}`, dto).then(r => r.data),
  cambiarPassword: (id: number, dto: { passwordActual?: string; nuevoPassword: string; confirmarPassword: string; codigoTwoFactor?: string }) =>
    api.put(`/usuarios/${id}/cambiar-password`, dto).then(r => r.data),
  enviarCodigoCambioPwd: (id: number) =>
    api.post<{ mensaje: string }>(`/usuarios/${id}/enviar-codigo-cambio-pwd`).then(r => r.data),
  delete: (id: number) =>
    api.delete(`/usuarios/${id}`),
  getCodigoReset: (id: number) =>
    api.get<{ codigo: string }>(`/usuarios/${id}/codigo-reset`).then(r => r.data),
  enviarCodigoReset: (id: number) =>
    api.post(`/usuarios/${id}/enviar-codigo-reset`).then(r => r.data),
}

// ── Comprobantes ──────────────────────────────────────────────────────────
export const comprobantesApi = {
  getAll: (soloActivos = false) =>
    api.get<TipoComprobanteResponse[]>('/comprobantes', { params: { soloActivos } }).then(r => r.data),
  create: (dto: CreateTipoComprobanteDto) =>
    api.post<TipoComprobanteResponse>('/comprobantes', dto).then(r => r.data),
  update: (id: number, dto: UpdateTipoComprobanteDto) =>
    api.put<TipoComprobanteResponse>(`/comprobantes/${id}`, dto).then(r => r.data),
  delete: (id: number) =>
    api.delete(`/comprobantes/${id}`),
  validarNcf: (ncf: string, rncEmisor?: string, rncReceptor?: string) =>
    api.post<ValidarNcfResponse>('/comprobantes/validar-ncf', { ncf, rncEmisor, rncReceptor }).then(r => r.data),
  ncfEstado: () =>
    api.get<{ habilitado: boolean; mensaje: string }>('/comprobantes/ncf-estado').then(r => r.data),
  // NCF Pool
  ncfProximo: (tipoId: number) =>
    api.get<NcfProximoResponse>(`/comprobantes/${tipoId}/ncf-proximo`).then(r => r.data),
  ncfPool: (tipoId: number, estado?: string) =>
    api.get<NcfSecuenciaResponse[]>(`/comprobantes/${tipoId}/ncf-pool`, { params: { estado } }).then(r => r.data),
  ncfPoolResumen: (tipoId: number) =>
    api.get<NcfPoolResumenResponse>(`/comprobantes/${tipoId}/ncf-pool/resumen`).then(r => r.data),
  cargarNcfLote: (dto: CargarNcfLoteDto) =>
    api.post<NcfLoteCreadoResponse>('/comprobantes/ncf-pool/cargar', dto).then(r => r.data),
  eliminarNcf: (id: number) =>
    api.delete(`/comprobantes/ncf-pool/${id}`),
  /** Reserva el próximo NCF disponible para un tipo B (al seleccionar comprobante en el carrito) */
  reservarNcf: (tipoId: number) =>
    api.post<NcfReservadoResponse>(`/comprobantes/${tipoId}/ncf-reservar`).then(r => r.data),
  /** Libera un NCF reservado de vuelta al pool (cancelación de carrito o cambio de tipo) */
  liberarNcfReserva: (ncfSecuenciaId: number) =>
    api.delete(`/comprobantes/ncf-pool/reservar/${ncfSecuenciaId}`),
}

// ── Caja ──────────────────────────────────────────────────────────────────
export const cajaApi = {
  activa: () =>
    api.get<CajaSessionResponse>('/caja/activa').then(r => r.data),
  abrir: (dto: AbrirCajaDto) =>
    api.post<CajaSessionResponse>('/caja/abrir', dto).then(r => r.data),
  cerrar: (id: number, dto: CerrarCajaDto) =>
    api.post<CajaSessionResponse>(`/caja/${id}/cerrar`, dto).then(r => r.data),
  getAll: (params?: { desde?: string; hasta?: string; usuarioId?: number }) =>
    api.get<CajaSessionResponse[]>('/caja', { params }).then(r => r.data),
  getById: (id: number) =>
    api.get<CajaSessionResponse>(`/caja/${id}`).then(r => r.data),
  misSesiones: (params?: { desde?: string; hasta?: string }) =>
    api.get<CajaSessionResponse[]>('/caja/mis-sesiones', { params }).then(r => r.data),
  /** Sesiones activas con totales en tiempo real — solo Admin/Gerente */
  activasConTotales: () =>
    api.get<CajaSessionResponse[]>('/caja/activas').then(r => r.data),
  /** Activa o desactiva validación de facturas — solo Admin/Gerente */
  validar: (id: number, dto: ValidarCajaDto) =>
    api.patch<CajaSessionResponse>(`/caja/${id}/validar`, dto).then(r => r.data),
}

// ── Reportes ──────────────────────────────────────────────────────────────
export const reportesApi = {
  ventas: (params?: { desde?: string; hasta?: string }) =>
    api.get<ReporteVentas>('/reportes/ventas', { params }).then(r => r.data),
  itbis: (params?: { desde?: string; hasta?: string }) =>
    api.get<ReporteItbis>('/reportes/itbis', { params }).then(r => r.data),
  productosMasVendidos: (params?: { desde?: string; hasta?: string; top?: number }) =>
    api.get<ProductoMasVendido[]>('/reportes/productos-mas-vendidos', { params }).then(r => r.data),
  rentabilidad: (params?: { desde?: string; hasta?: string }) =>
    api.get<ReporteRentabilidad>('/reportes/rentabilidad', { params }).then(r => r.data),
}

// ── Permisos por usuario (overrides) ─────────────────────────────────────
export const permisosApi = {
  get: (usuarioId: number) =>
    api.get<PermisosUsuario>(`/usuarios/${usuarioId}/permisos`).then(r => r.data),
  update: (usuarioId: number, dto: PermisosUsuario) =>
    api.put<PermisosUsuario>(`/usuarios/${usuarioId}/permisos`, dto).then(r => r.data),
  reset: (usuarioId: number) =>
    api.delete(`/usuarios/${usuarioId}/permisos`),
}

// ── Permisos por rol (editables por el admin) ─────────────────────────────
export const permisosRolApi = {
  getAll: () =>
    api.get<PermisosRol[]>('/permisos-rol').then(r => r.data),
  update: (rol: string, dto: Omit<PermisosRol, 'rol'>) =>
    api.put<PermisosRol>(`/permisos-rol/${rol}`, dto).then(r => r.data),
}

// ── Cotizaciones ──────────────────────────────────────────────────────────────────────────
export const cotizacionesApi = {
  getAll: () =>
    api.get<CotizacionResponse[]>('/cotizaciones').then(r => r.data),
  getById: (id: number) =>
    api.get<CotizacionResponse>(`/cotizaciones/${id}`).then(r => r.data),
  create: (dto: CreateCotizacionDto) =>
    api.post<CotizacionResponse>('/cotizaciones', dto).then(r => r.data),
  concretar: (id: number, ventaId?: number) =>
    api.post(`/cotizaciones/${id}/concretar`, ventaId ?? null).then(r => r.data),
  cancelar: (id: number) =>
    api.delete(`/cotizaciones/${id}`).then(r => r.data),
}

// ── Licencias Admin ────────────────────────────────────────────────────
export interface LicenciaAdmin {
  id: number
  sistemaKey: string
  nombreCliente: string
  estado: 'activo' | 'mantenimiento' | 'bloqueado_pago' | 'bloqueado'
  mensaje: string | null
  fechaVencimiento: string | null
  fechaCreacion: string
  ultimaActualizacion: string
}

export interface CreateLicenciaDto {
  sistemaKey: string
  nombreCliente: string
  estado?: string
  mensaje?: string | null
  fechaVencimiento?: string | null
}

export interface UpdateLicenciaDto {
  nombreCliente?: string
  estado?: string
  mensaje?: string | null
  fechaVencimiento?: string | null
}

export const licenciasAdminApi = {
  listar: () =>
    api.get<LicenciaAdmin[]>('/licencias-admin').then(r => r.data),

  obtener: (key: string) =>
    api.get<LicenciaAdmin>(`/licencias-admin/${key}`).then(r => r.data),

  crear: (dto: CreateLicenciaDto) =>
    api.post<LicenciaAdmin>('/licencias-admin', dto).then(r => r.data),

  actualizar: (key: string, dto: UpdateLicenciaDto) =>
    api.put<LicenciaAdmin>(`/licencias-admin/${key}`, dto).then(r => r.data),

  eliminar: (key: string) =>
    api.delete(`/licencias-admin/${key}`),
}
