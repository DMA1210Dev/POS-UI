import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect, useState } from 'react'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/auth/LoginPage'
import LicenciaBlockPage, { type LicenciaCodigo } from './pages/LicenciaBlockPage'
import { useAuth } from './context/AuthContext'
import { useComercio } from './context/ComercioContext'

const TITULOS: Record<string, string> = {
  '/login':        'Iniciar sesión',
  '/recuperar':    'Recuperar contraseña',
  '/dashboard':    'Dashboard',
  '/ventas/nueva': 'Nueva Venta',
  '/ventas':       'Ventas',
  '/productos':    'Productos',
  '/stock-bajo':   'Stock Bajo',
  '/clientes':     'Clientes',
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

  // Actualiza el favicon con el logo del comercio
  useEffect(() => {
    const existing = document.querySelector("link[rel='icon']") as HTMLLinkElement | null
    const link: HTMLLinkElement = existing ?? document.createElement('link')
    if (!existing) {
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.href = comercio?.logoUrl
      ? comercio.logoUrl.split('?')[0] + '?v=' + Date.now()   // cache-buster fresco
      : '/vite.svg'
  }, [comercio?.logoUrl])

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
const CreditosPage   = lazy(() => import('./pages/creditos/CreditosPage'))
const UsuariosPage   = lazy(() => import('./pages/usuarios/UsuariosPage'))
const EmpleadosPage  = lazy(() => import('./pages/empleados/EmpleadosPage'))
const ReportesPage   = lazy(() => import('./pages/reportes/ReportesPage'))
const PerfilPage     = lazy(() => import('./pages/perfil/PerfilPage'))
const ComercioPage      = lazy(() => import('./pages/configuracion/ComercioPage'))
const ComprobantesPage  = lazy(() => import('./pages/configuracion/ComprobantesPage'))
const PermisosPage      = lazy(() => import('./pages/configuracion/PermisosPage'))
const RolesPage         = lazy(() => import('./pages/configuracion/RolesPage'))
const ServidorPage      = lazy(() => import('./pages/configuracion/ServidorPage'))
const CajaPage          = lazy(() => import('./pages/caja/CajaPage'))
const ProximamentePage  = lazy(() => import('./pages/ProximamentePage'))
const RecuperarPage     = lazy(() => import('./pages/auth/RecuperarPage'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

const S = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<PageLoader />}>{children}</Suspense>
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
        <Route path="clientes" element={
          <RoleRoute allowed={puedeVerClientes}>
            <S><ClientesPage /></S>
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
        <Route path="compras"   element={<S><ProximamentePage /></S>} />
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
