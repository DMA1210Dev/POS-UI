import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Package, ShoppingCart, Users,
  BarChart2, UserCog, LogOut, AlertTriangle, UserCircle, Store, Palette, Receipt, Vault,
  ChevronDown, Clock,
  BookOpen, Warehouse, ClipboardList, TrendingUp, DollarSign, Briefcase, FolderKanban,
  Settings, ShieldCheck, Shield, Server, FileSpreadsheet, FileText,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useComercio } from '../../context/ComercioContext'
import { useRoles } from '../../context/RolesContext'
import NotificacionBell from '../ui/NotificacionBell'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  children?: NavItem[]
}

interface SectionDef {
  key: string
  label: string
  icon: React.ReactNode
  items: NavItem[]
  empty?: boolean // secciones reservadas sin módulos aún
}

export default function Sidebar() {
  const { comercio } = useComercio()
  const location = useLocation()
  const { user, logout,
    puedeVerDashboard, puedeCrearVentas, puedeVerTodasVentas,
    tieneAccesoProductos, puedeGestionarProductos,
    puedeVerClientes, puedeGestionarCreditos,
    puedeVerReportes, puedeVerStockBajo, puedeGestionarUsuarios,
    puedeGestionarCaja, isCajero, isAdmin,
    puedeGestionarEmpleados,
  } = useAuth()
  const { getLabelForRol } = useRoles()

  // Caja visible solo si: tiene permiso Y (caja chica activa O es admin)
  const verCaja = puedeGestionarCaja && (comercio?.permitirCajaChica !== false || isAdmin)

  const rolKey   = user?.rol ?? ''
  const rolLabel = getLabelForRol(rolKey)

  const sections: SectionDef[] = [
    {
      key: 'ventas',
      label: 'Ventas',
      icon: <TrendingUp size={16} />,
      items: [
        puedeCrearVentas && { to: '/ventas/nueva', label: 'Nueva Venta',  icon: <ShoppingCart size={16} /> },
        (puedeVerTodasVentas || isCajero) && { to: '/ventas', label: 'Historial',    icon: <ClipboardList size={16} /> },
        puedeVerClientes && { to: '/clientes',     label: 'Clientes',     icon: <Users size={16} /> },
      ].filter(Boolean) as NavItem[],
    },
    {
      key: 'almacen',
      label: 'Almacén',
      icon: <Warehouse size={16} />,
      items: [
        tieneAccesoProductos     && { to: '/productos',   label: 'Productos',   icon: <Package size={16} /> },
        puedeVerStockBajo        && { to: '/stock-bajo',  label: 'Stock Bajo',  icon: <AlertTriangle size={16} /> },
      ].filter(Boolean) as NavItem[],
    },
    {
      key: 'cobros',
      label: 'Cobros',
      icon: <DollarSign size={16} />,
      items: [
        puedeGestionarCreditos && { to: '/cobros', label: 'Cobros', icon: <DollarSign size={16} /> },
        verCaja                && { to: '/caja',     label: 'Caja',     icon: <Vault size={16} /> },
      ].filter(Boolean) as NavItem[],
    },
    {
      key: 'contabilidad',
      label: 'Contabilidad',
      icon: <BookOpen size={16} />,
      items: [
        {
          to: '/reportes', label: 'Reportes', icon: <BarChart2 size={16} />,
          children: [
            { to: '/reportes', label: 'Dashboard', icon: <BarChart2 size={16} /> },
            { to: '/contabilidad/mayor-general', label: 'Mayor General', icon: <BarChart2 size={16} /> },
            { to: '/contabilidad/balance-general', label: 'Balance General', icon: <BarChart2 size={16} /> },
            { to: '/contabilidad/estado-saldos', label: 'Estado de Saldos', icon: <BarChart2 size={16} /> },
          ],
        },
        puedeGestionarProductos  && { to: '/comprobantes',  label: 'Comprobantes',  icon: <Receipt size={16} /> },
        puedeGestionarUsuarios   && { to: '/contabilidad/cuentas', label: 'Catálogo de Cuentas', icon: <BookOpen size={16} /> },
        puedeVerReportes         && { to: '/contabilidad/asientos', label: 'Asientos', icon: <FileText size={16} /> },
      ].filter(Boolean) as NavItem[],
    },
    {
      key: 'compras',
      label: 'Compras',
      icon: <ClipboardList size={16} />,
      items: [
        { to: '/compras', label: 'Próximamente', icon: <Clock size={16} /> },
      ],
    },
    {
      key: 'rrhh',
      label: 'RRHH',
      icon: <Briefcase size={16} />,
      items: [
        puedeGestionarEmpleados && { to: '/empleados', label: 'Empleados', icon: <Users size={16} /> },
        puedeGestionarEmpleados && { to: '/nomina', label: 'Nómina', icon: <Receipt size={16} /> },
        puedeGestionarEmpleados && { to: '/nomina/general', label: 'Nómina General', icon: <FileSpreadsheet size={16} /> },
      ].filter(Boolean) as NavItem[],
    },
    {
      key: 'proyectos',
      label: 'Proyectos',
      icon: <FolderKanban size={16} />,
      items: [
        { to: '/proyectos', label: 'Próximamente', icon: <Clock size={16} /> },
      ],
    },
    // Configuración — solo Admin
    ...(puedeGestionarUsuarios ? [{
      key: 'configuracion',
      label: 'Configuración',
      icon: <Settings size={16} />,
      items: [
        { to: '/comercio',                  label: 'Mi Comercio',    icon: <Store size={16} /> },
        { to: '/apariencia',                label: 'Apariencia',     icon: <Palette size={16} /> },
        { to: '/usuarios',                  label: 'Usuarios',       icon: <UserCog size={16} /> },
        { to: '/configuracion/roles',       label: 'Roles',          icon: <Shield size={16} /> },
        { to: '/configuracion/permisos',    label: 'Permisos',       icon: <ShieldCheck size={16} /> },
        { to: '/configuracion/servidor',    label: 'Servidor',       icon: <Server size={16} /> },
      ] as NavItem[],
    }] : []),
  ]

  // Secciones que deben abrirse por defecto (la activa)
  const getDefaultOpen = () => {
    const open: Record<string, boolean> = {}
    sections.forEach(s => {
      if (s.items.some(item => {
        if (item.children) return item.children.some(c => location.pathname.startsWith(c.to))
        return location.pathname.startsWith(item.to)
      })) {
        open[s.key] = true
      }
    })
    return open
  }

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(getDefaultOpen)

  const toggle = (key: string) =>
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors ml-3 ${
      isActive
        ? 'bg-white/20 text-white'
        : 'text-white/60 hover:bg-white/10 hover:text-white'
    }`

  return (
    <aside
      className="w-60 text-white flex flex-col h-screen sticky top-0"
      style={{ background: 'linear-gradient(to bottom, var(--color-menu, #1e293b), var(--color-menu-fin, #1e293b))' }}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/10">
        {comercio?.logoUrl ? (
          <img
            src={comercio.logoUrl}
            alt={comercio.nombre}
            className="h-16 w-full object-contain mb-3 mx-auto block"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <img
            src="/logo-white.svg"
            alt="domercd"
            className="h-8 mx-auto mb-2 block"
          />
        )}
        <div className="flex items-center justify-between gap-1">
          <p className="text-xs text-white/50 truncate">
            {user?.nombre}
            <span className="text-white/40"> · {rolLabel}</span>
          </p>
          <NotificacionBell />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">

        {/* Dashboard — enlace directo */}
        {puedeVerDashboard && (
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-white/20 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <LayoutDashboard size={16} />
            Dashboard
          </NavLink>
        )}

        {/* Divisor */}
        <div className="h-px bg-white/10 my-1" />

        {/* Secciones colapsables */}
        {sections.filter(s => s.items.length > 0).map(section => {
          const isAnyActive = section.items.some(item => {
            if (item.children) return item.children.some(c => location.pathname.startsWith(c.to))
            return location.pathname.startsWith(item.to)
          })
          const isOpen = !!openSections[section.key]

          return (
            <div key={section.key} className="mt-0.5">
              <button
                onClick={() => toggle(section.key)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  isAnyActive && !isOpen
                    ? 'text-white hover:bg-white/10'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  {section.icon}
                  <span className="font-medium">{section.label}</span>
                </span>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isOpen && (
                <div className="mt-0.5 mb-1 space-y-0.5">
                  {section.items.map(item => {
                    if (item.children && item.children.length > 0) {
                      const isChildActive = item.children.some(c => location.pathname.startsWith(c.to))
                      return (
                        <div key={item.to}>
                          <NavLink to={item.to} end className={navLinkClass}>
                            {item.icon}
                            {item.label}
                          </NavLink>
                          {(isChildActive) && (
                            <div className="ml-1 mt-0.5 space-y-0.5">
                              {item.children.map(child => (
                                <NavLink key={child.to} to={child.to} className={navLinkClass}>
                                  <span className="w-1 h-1 rounded-full bg-white/40" />
                                  {child.label}
                                </NavLink>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    }
                    return (
                      <NavLink key={item.to} to={item.to} className={navLinkClass}>
                        {item.icon}
                        {item.label}
                      </NavLink>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t border-white/10 space-y-0.5">
        <NavLink
          to="/perfil"
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive
                ? 'bg-white/20 text-white'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`
          }
        >
          <UserCircle size={16} />
          Mi perfil
        </NavLink>
        <button
          onClick={logout}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/70 hover:bg-danger-600 hover:text-white w-full transition-colors"
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
