import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect, useState } from 'react'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/auth/LoginPage'
import LicenciaBlockPage, { type LicenciaCodigo } from './pages/LicenciaBlockPage'
import { useAuth } from './context/AuthContext'
import { useComercio } from './context/ComercioContext'
import ErrorBoundary from './components/ui/ErrorBoundary'

const TITULOS: Record<string, string> = {
  '/login':        'Iniciar sesión',
  '/recuperar':    'Recuperar contraseña',
  '/dashboard':    'Dashboard',
  '/ventas/nueva': 'Nueva Venta',
  '/ventas':       'Ventas',
  '/productos':    'Productos',
  '/stock-bajo':   'Stock Bajo',
  '/almacen/entradas': 'Entradas de Mercancía',
  '/almacen/salidas':  'Salidas de Mercancía',
  '/almacen/reportes': 'Reportes de Almacén',
  '/clientes':     'Clientes',
  '/cobros':       'Cobros',
  '/creditos':     'Créditos',
  '/usuarios':     'Usuarios',
  '/empleados':    'Empleados',
  '/reportes':     'Reportes',
  '/perfil':       'Mi Perfil',
  '/caja':                   'Caja',
  '/comercio':               'Mi Comercio',
  '/comprobantes':           'Comprobantes',
  '/configuracion/permisos': 'Permisos de Usuarios',
  '/configuracion/roles':    'Gestión de Roles',
  '/configuracion/servidor': 'Estado del Servidor',
  '/contabilidad/cuentas':   'Catálogo de Cuentas',
  '/contabilidad/asientos':  'Asientos Contables',
  '/contabilidad/mayor-general': 'Mayor General',
  '/contabilidad/balance-general': 'Balance General',
  '/contabilidad/estado-saldos': 'Estado de Saldos',
  '/contabilidad/estado-resultados': 'Estado de Resultados',
  '/contabilidad/libro-diario': 'Libro Diario',
  '/contabilidad/cierre-contable': 'Cierre Contable',
  '/contabilidad/bancos': 'Auxiliar de Bancos',
  '/contabilidad/conciliaciones': 'Conciliaciones Bancarias',
  '/contabilidad/tasas': 'Tasas de Cambio',
  '/contabilidad/activos': 'Activos Fijos',
  '/contabilidad/dgii': 'Reportes DGII',
  '/contabilidad/proveedores': 'Proveedores',
  '/contabilidad/cxp': 'Cuentas por Pagar',
}

function PageTitle() {
  const { pathname } = useLocation()
  const { comercio } = useComercio()
  const appName = comercio?.nombre ?? 'POS Sistema'

  // Actualiza el título de la pestaña según la ruta
  useEffect(() => {
    const nombre = TITULOS[pathname] ?? appName
    document.title = `${nombre} | ${appName}`
  }, [pathname, appName])

  return null
}

// Guard genérico: redirige al home del usuario si no tiene permiso
function RoleRoute({ allowed, children }: { allowed: boolean; children: React.ReactNode }) {
  const { puedeVerDashboard, puedeCrearVentas, tieneAccesoProductos } = useAuth()
  if (!allowed) {
    const home =
      !puedeVerDashboard && tieneAccesoProductos && !puedeCrearVentas ? '/productos' :
      !puedeVerDashboard && puedeCrearVentas                          ? '/ventas/nueva' :
      '/dashboard'
    return <Navigate to={home} replace />
  }
  return <>{children}</>
}

const DashboardPage  = lazy(() => import('./pages/dashboard/DashboardPage'))
const ProductosPage  = lazy(() => import('./pages/productos/ProductosPage'))
const StockBajoPage  = lazy(() => import('./pages/productos/StockBajoPage'))
const VentasPage     = lazy(() => import('./pages/ventas/VentasPage'))
const NuevaVentaPage  = lazy(() => import('./pages/ventas/NuevaVentaPage'))
const EditarVentaPage = lazy(() => import('./pages/ventas/EditarVentaPage'))
const ClientesPage   = lazy(() => import('./pages/clientes/ClientesPage'))
const CobrosPage     = lazy(() => import('./pages/cobros/CobrosPage'))
const CreditosPage   = lazy(() => import('./pages/creditos/CreditosPage'))
const UsuariosPage   = lazy(() => import('./pages/usuarios/UsuariosPage'))
const EmpleadosPage  = lazy(() => import('./pages/empleados/EmpleadosPage'))
const NominaPage     = lazy(() => import('./pages/nomina/NominaPage'))
const NominaGeneralPage = lazy(() => import('./pages/nomina/NominaGeneralPage'))
const ReportesPage   = lazy(() => import('./pages/reportes/ReportesPage'))
const PerfilPage     = lazy(() => import('./pages/perfil/PerfilPage'))
const ComercioPage      = lazy(() => import('./pages/configuracion/ComercioPage'))
const AparienciaPage    = lazy(() => import('./pages/configuracion/AparienciaPage'))
const ComprobantesPage  = lazy(() => import('./pages/configuracion/ComprobantesPage'))
const PermisosPage      = lazy(() => import('./pages/configuracion/PermisosPage'))
const RolesPage         = lazy(() => import('./pages/configuracion/RolesPage'))
const ServidorPage      = lazy(() => import('./pages/configuracion/ServidorPage'))
const CajaPage          = lazy(() => import('./pages/caja/CajaPage'))
const CatalogoCuentasPage = lazy(() => import('./pages/contabilidad/CatalogoCuentasPage'))
const AsientosPage = lazy(() => import('./pages/contabilidad/AsientosPage'))
const MayorGeneralPage = lazy(() => import('./pages/contabilidad/MayorGeneralPage'))
const BalanceGeneralPage = lazy(() => import('./pages/contabilidad/BalanceGeneralPage'))
const EstadoSaldosPage = lazy(() => import('./pages/contabilidad/EstadoSaldosPage'))
const EstadoResultadosPage = lazy(() => import('./pages/contabilidad/EstadoResultadosPage'))
const LibroDiarioPage = lazy(() => import('./pages/contabilidad/LibroDiarioPage'))
const CierreContablePage = lazy(() => import('./pages/contabilidad/CierreContablePage'))
const TasasCambioPage = lazy(() => import('./pages/contabilidad/bancos/TasasCambioPage'))
const CuentasBancoPage = lazy(() => import('./pages/contabilidad/bancos/CuentasBancoPage'))
const ConciliacionBancariaPage = lazy(() => import('./pages/contabilidad/bancos/ConciliacionBancariaPage'))
const ActivosFijosPage = lazy(() => import('./pages/contabilidad/activos/ActivosFijosPage'))
const DgiiPage = lazy(() => import('./pages/contabilidad/reportes/DgiiPage'))
const ProveedoresPage = lazy(() => import('./pages/contabilidad/cxp/ProveedoresPage'))
const CuentasPagarPage = lazy(() => import('./pages/contabilidad/cxp/CuentasPagarPage'))
const ProximamentePage  = lazy(() => import('./pages/ProximamentePage'))
const RecuperarPage     = lazy(() => import('./pages/auth/RecuperarPage'))
const EntradasAlmacenPage = lazy(() => import('./pages/almacen/EntradasPage'))
const SalidasAlmacenPage  = lazy(() => import('./pages/almacen/SalidasPage'))
const ReportesAlmacenPage = lazy(() => import('./pages/almacen/ReportesAlmacenPage'))
const OrdenesPage         = lazy(() => import('./pages/compras/OrdenesPage'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

const S = ({ children }: { children: React.ReactNode }) => (
  <ErrorBoundary>
    <Suspense fallback={<PageLoader />}>{children}</Suspense>
  </ErrorBoundary>
)

function AppRoutes() {
  const {
    puedeVerDashboard, puedeCrearVentas, puedeEditarVentas,
    puedeVerTodasVentas, isCajero,
    tieneAccesoProductos, puedeGestionarProductos,
    puedeVerClientes, puedeGestionarCreditos,
    puedeVerReportes, puedeVerStockBajo,
    puedeGestionarUsuarios, puedeGestionarCaja, isAdmin,
    puedeGestionarEmpleados,
  } = useAuth()
  const { comercio } = useComercio()

  // Home page según permisos efectivos
  const homePage =
    !puedeVerDashboard && tieneAccesoProductos && !puedeCrearVentas ? '/productos' :
    !puedeVerDashboard && puedeCrearVentas                          ? '/ventas/nueva' :
    '/dashboard'

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/recuperar" element={<S><RecuperarPage /></S>} />
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to={homePage} replace />} />

        <Route path="dashboard" element={
          <RoleRoute allowed={puedeVerDashboard}>
            <S><DashboardPage /></S>
          </RoleRoute>
        } />
        <Route path="ventas/nueva" element={
          <RoleRoute allowed={puedeCrearVentas}>
            <S><NuevaVentaPage /></S>
          </RoleRoute>
        } />
        <Route path="ventas/:id/editar" element={
          <RoleRoute allowed={puedeEditarVentas}>
            <S><EditarVentaPage /></S>
          </RoleRoute>
        } />
        <Route path="ventas" element={
          <RoleRoute allowed={puedeVerTodasVentas || isCajero}>
            <S><VentasPage /></S>
          </RoleRoute>
        } />
        <Route path="productos" element={
          <RoleRoute allowed={tieneAccesoProductos}>
            <S><ProductosPage /></S>
          </RoleRoute>
        } />
        <Route path="stock-bajo" element={
          <RoleRoute allowed={puedeVerStockBajo}>
            <S><StockBajoPage /></S>
          </RoleRoute>
        } />
        <Route path="almacen/entradas" element={
          <RoleRoute allowed={tieneAccesoProductos}>
            <S><EntradasAlmacenPage /></S>
          </RoleRoute>
        } />
        <Route path="almacen/salidas" element={
          <RoleRoute allowed={tieneAccesoProductos}>
            <S><SalidasAlmacenPage /></S>
          </RoleRoute>
        } />
        <Route path="almacen/reportes" element={
          <RoleRoute allowed={puedeVerReportes}>
            <S><ReportesAlmacenPage /></S>
          </RoleRoute>
        } />
        <Route path="clientes" element={
          <RoleRoute allowed={puedeVerClientes}>
            <S><ClientesPage /></S>
          </RoleRoute>
        } />
        <Route path="cobros" element={
          <RoleRoute allowed={puedeGestionarCreditos}>
            <S><CobrosPage /></S>
          </RoleRoute>
        } />
        <Route path="creditos" element={
          <RoleRoute allowed={puedeGestionarCreditos}>
            <S><CreditosPage /></S>
          </RoleRoute>
        } />
        <Route path="usuarios" element={
          <RoleRoute allowed={puedeGestionarUsuarios}>
            <S><UsuariosPage /></S>
          </RoleRoute>
        } />
        <Route path="empleados" element={
          <RoleRoute allowed={puedeGestionarEmpleados}>
            <S><EmpleadosPage /></S>
          </RoleRoute>
        } />
        <Route path="nomina" element={
          <RoleRoute allowed={puedeGestionarEmpleados}>
            <S><NominaPage /></S>
          </RoleRoute>
        } />
        <Route path="nomina/general" element={
          <RoleRoute allowed={puedeGestionarEmpleados}>
            <S><NominaGeneralPage /></S>
          </RoleRoute>
        } />
        <Route path="reportes" element={
          <RoleRoute allowed={puedeVerReportes}>
            <S><ReportesPage /></S>
          </RoleRoute>
        } />
        <Route path="perfil" element={<S><PerfilPage /></S>} />
        <Route path="comercio" element={
          <RoleRoute allowed={puedeGestionarUsuarios}>
            <S><ComercioPage /></S>
          </RoleRoute>
        } />
        <Route path="apariencia" element={
          <RoleRoute allowed={puedeGestionarUsuarios}>
            <S><AparienciaPage /></S>
          </RoleRoute>
        } />
        <Route path="comprobantes" element={
          <RoleRoute allowed={puedeGestionarProductos}>
            <S><ComprobantesPage /></S>
          </RoleRoute>
        } />
        <Route path="caja" element={
          <RoleRoute allowed={puedeGestionarCaja && (comercio?.permitirCajaChica !== false || isAdmin)}>
            <S><CajaPage /></S>
          </RoleRoute>
        } />
        <Route path="configuracion/permisos" element={
          <RoleRoute allowed={puedeGestionarUsuarios}>
            <S><PermisosPage /></S>
          </RoleRoute>
        } />
        <Route path="configuracion/roles" element={
          <RoleRoute allowed={puedeGestionarUsuarios}>
            <S><RolesPage /></S>
          </RoleRoute>
        } />
        <Route path="configuracion/servidor" element={
          <RoleRoute allowed={puedeGestionarUsuarios}>
            <S><ServidorPage /></S>
          </RoleRoute>
        } />
        <Route path="compras/ordenes" element={<S><OrdenesPage /></S>} />
        <Route path="contabilidad/cuentas" element={
          <RoleRoute allowed={puedeGestionarUsuarios}>
            <S><CatalogoCuentasPage /></S>
          </RoleRoute>
        } />
        <Route path="contabilidad/asientos" element={
          <RoleRoute allowed={puedeVerReportes}>
            <S><AsientosPage /></S>
          </RoleRoute>
        } />
        <Route path="contabilidad/mayor-general" element={
          <RoleRoute allowed={puedeVerReportes}>
            <S><MayorGeneralPage /></S>
          </RoleRoute>
        } />
        <Route path="contabilidad/balance-general" element={
          <RoleRoute allowed={puedeVerReportes}>
            <S><BalanceGeneralPage /></S>
          </RoleRoute>
        } />
        <Route path="contabilidad/estado-saldos" element={
          <RoleRoute allowed={puedeVerReportes}>
            <S><EstadoSaldosPage /></S>
          </RoleRoute>
        } />
        <Route path="contabilidad/estado-resultados" element={
          <RoleRoute allowed={puedeVerReportes}>
            <S><EstadoResultadosPage /></S>
          </RoleRoute>
        } />
        <Route path="contabilidad/libro-diario" element={
          <RoleRoute allowed={puedeVerReportes}>
            <S><LibroDiarioPage /></S>
          </RoleRoute>
        } />
        <Route path="contabilidad/cierre-contable" element={
          <RoleRoute allowed={puedeGestionarUsuarios}>
            <S><CierreContablePage /></S>
          </RoleRoute>
        } />
        <Route path="contabilidad/tasas" element={
          <RoleRoute allowed={puedeGestionarUsuarios}>
            <S><TasasCambioPage /></S>
          </RoleRoute>
        } />
        <Route path="contabilidad/activos" element={
          <RoleRoute allowed={puedeGestionarUsuarios}>
            <S><ActivosFijosPage /></S>
          </RoleRoute>
        } />
        <Route path="contabilidad/dgii" element={
          <RoleRoute allowed={puedeGestionarUsuarios}>
            <S><DgiiPage /></S>
          </RoleRoute>
        } />
        <Route path="contabilidad/bancos" element={
          <RoleRoute allowed={puedeGestionarUsuarios}>
            <S><CuentasBancoPage /></S>
          </RoleRoute>
        } />
        <Route path="contabilidad/conciliaciones" element={
          <RoleRoute allowed={puedeGestionarUsuarios}>
            <S><ConciliacionBancariaPage /></S>
          </RoleRoute>
        } />
        <Route path="contabilidad/proveedores" element={
          <RoleRoute allowed={puedeGestionarUsuarios}>
            <S><ProveedoresPage /></S>
          </RoleRoute>
        } />
        <Route path="contabilidad/cxp" element={
          <RoleRoute allowed={puedeGestionarUsuarios}>
            <S><CuentasPagarPage /></S>
          </RoleRoute>
        } />
        <Route path="proyectos" element={<S><ProximamentePage /></S>} />
        <Route path="*" element={<Navigate to={homePage} replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  const [bloqueo, setBloqueo] = useState<{ codigo: LicenciaCodigo; error: string; fechaVencimiento?: string } | null>(null)

  useEffect(() => {
    const handler = (e: Event) => setBloqueo((e as CustomEvent).detail)
    window.addEventListener('licencia-bloqueada', handler)
    return () => window.removeEventListener('licencia-bloqueada', handler)
  }, [])

  return (
    <>
      <PageTitle />
      <AppRoutes />
      {bloqueo && (
        <LicenciaBlockPage
          codigo={bloqueo.codigo}
          mensaje={bloqueo.error}
          fechaVencimiento={bloqueo.fechaVencimiento}
          onDismiss={() => setBloqueo(null)}
        />
      )}
    </>
  )
}
