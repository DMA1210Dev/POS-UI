import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Bell, CheckCheck, Clock, CheckCircle, XCircle, Info } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { notificacionesApi } from '../../api'
import type { NotificacionResponse, TipoNotificacion } from '../../types'

const fmtFecha = (d: string) =>
  new Date(d).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' })

function TipoIcon({ tipo }: { tipo: TipoNotificacion }) {
  switch (tipo) {
    case 'AprobacionPendiente':
    case 'AprobadorAsignado':
      return <Clock size={13} className="text-warning-500 shrink-0 mt-0.5" />
    case 'VentaAprobada':
      return <CheckCircle size={13} className="text-success-500 shrink-0 mt-0.5" />
    case 'VentaAnulada':
      return <XCircle size={13} className="text-danger-500 shrink-0 mt-0.5" />
    default:
      return <Info size={13} className="text-brand-500 shrink-0 mt-0.5" />
  }
}

export default function NotificacionBell() {
  const [open, setOpen]     = useState(false)
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 })
  const btnRef   = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const qc       = useQueryClient()

  const { data: notificaciones = [] } = useQuery<NotificacionResponse[]>({
    queryKey: ['notificaciones'],
    queryFn:  notificacionesApi.getAll,
    refetchInterval: 30_000,
    retry: false,
    gcTime: 60_000,
  })

  const noLeidas = notificaciones.filter(n => !n.leida).length

  const marcarLeida = useMutation({
    mutationFn: (id: number) => notificacionesApi.marcarLeida(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['notificaciones'] }),
  })

  const marcarTodas = useMutation({
    mutationFn: () => notificacionesApi.marcarTodasLeidas(),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['notificaciones'] }),
  })

  // Cerrar al hacer click fuera del panel
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current   && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggleOpen = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      // Abre justo a la derecha del sidebar (240px) y alineado verticalmente con el botón
      setPanelPos({ top: rect.top, left: 248 })
    }
    setOpen(o => !o)
  }

  const handleNotifClick = (n: NotificacionResponse) => {
    if (!n.leida) marcarLeida.mutate(n.id)
    if (n.ventaId) { setOpen(false); navigate('/ventas') }
  }

  const panel = open && createPortal(
    <div
      ref={panelRef}
      style={{ top: panelPos.top, left: panelPos.left }}
      className="fixed w-80 bg-white rounded-xl shadow-2xl border border-slate-200 z-[9999] overflow-hidden"
    >
      {/* Cabecera */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-slate-50">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-slate-500" />
          <h4 className="font-semibold text-slate-700 text-sm">Notificaciones</h4>
          {noLeidas > 0 && (
            <span className="px-1.5 py-0.5 bg-danger-100 text-danger-600 text-[10px] font-bold rounded-full">
              {noLeidas} nueva{noLeidas !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {noLeidas > 0 && (
          <button
            onClick={() => marcarTodas.mutate()}
            disabled={marcarTodas.isPending}
            className="flex items-center gap-1 text-[11px] text-brand-600 hover:text-brand-800 disabled:opacity-50 transition-colors"
          >
            <CheckCheck size={11} /> Marcar leídas
          </button>
        )}
      </div>

      {/* Lista */}
      <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
        {notificaciones.length === 0 ? (
          <div className="py-10 text-center">
            <Bell size={24} className="mx-auto text-slate-200 mb-2" />
            <p className="text-sm text-slate-400">Sin notificaciones</p>
          </div>
        ) : (
          notificaciones.slice(0, 25).map(n => (
            <button
              key={n.id}
              onClick={() => handleNotifClick(n)}
              className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors flex gap-2.5 ${
                !n.leida ? 'bg-brand-50/70' : ''
              }`}
            >
              <TipoIcon tipo={n.tipo} />
              <div className="flex-1 min-w-0">
                <p className={`text-xs leading-relaxed ${!n.leida ? 'font-medium text-slate-700' : 'text-slate-500'}`}>
                  {n.mensaje}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">{fmtFecha(n.fechaCreacion)}</p>
              </div>
              {!n.leida && <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0 mt-1" />}
            </button>
          ))
        )}
      </div>
    </div>,
    document.body
  )

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggleOpen}
        title="Notificaciones"
        className="relative p-1.5 rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors"
      >
        <Bell size={15} />
        {noLeidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] bg-danger-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>
      {panel}
    </>
  )
}
