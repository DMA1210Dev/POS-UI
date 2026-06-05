import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Eye, FileText } from 'lucide-react'
import { asientosApi, cuentasContablesApi } from '../../api'
import { Card, CardBody } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import Input from '../../components/ui/Input'
import { useToast, errMsg } from '../../context/ToastContext'
import type { AsientoContableDetailDto, CuentaContableResponse } from '../../types'

const fmt = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(n)
const fmtFecha = (d: string) => new Date(d).toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' })
const fmtFechaISO = (d: Date) => d.toISOString().slice(0, 10)

export default function AsientosPage() {
  const qc = useQueryClient()
  const { success, error } = useToast()

  const [desde, setDesde] = useState(() => fmtFechaISO(new Date(new Date().getFullYear(), 0, 1)))
  const [hasta, setHasta] = useState(() => fmtFechaISO(new Date()))
  const [asientoId, setAsientoId] = useState<number | null>(null)
  const [asientoData, setAsientoData] = useState<AsientoContableDetailDto | null>(null)

  // Modal crear asiento
  const [showCrear, setShowCrear] = useState(false)
  const [concepto, setConcepto] = useState('')
  const [fecha, setFecha] = useState(() => fmtFechaISO(new Date()))
  const [lineas, setLineas] = useState<{ cuentaContableId: number; debe: string; haber: string }[]>([])
  const [cuentas, setCuentas] = useState<CuentaContableResponse[]>([])

  const { data: asientos, isLoading, isError, refetch } = useQuery({
    queryKey: ['asientos', desde, hasta],
    queryFn: () => asientosApi.getAll({ desde, hasta }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => asientosApi.delete(id),
    onSuccess: () => { success('Asiento desactivado'); qc.invalidateQueries({ queryKey: ['asientos'] }) },
    onError: (e) => error(errMsg(e)),
  })

  const createMutation = useMutation({
    mutationFn: (dto: Parameters<typeof asientosApi.create>[0]) => asientosApi.create(dto),
    onSuccess: () => {
      success('Asiento creado correctamente')
      setShowCrear(false); setConcepto(''); setLineas([])
      qc.invalidateQueries({ queryKey: ['asientos'] })
    },
    onError: (e) => error(errMsg(e)),
  })

  function abrirDetalle(id: number) {
    setAsientoId(id)
    asientosApi.getById(id).then(setAsientoData).catch(() => error('Error al cargar detalle'))
  }

  function abrirNuevoAsiento() {
    cuentasContablesApi.getAll({ soloActivas: true }).then(setCuentas).catch(() => {})
    setConcepto(''); setFecha(fmtFechaISO(new Date()))
    setLineas([{ cuentaContableId: 0, debe: '', haber: '' }])
    setShowCrear(true)
  }

  function addLinea() {
    setLineas(prev => [...prev, { cuentaContableId: 0, debe: '', haber: '' }])
  }

  function updateLinea(idx: number, field: string, value: string | number) {
    setLineas(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l))
  }

  function removeLinea(idx: number) {
    setLineas(prev => prev.filter((_, i) => i !== idx))
  }

  function guardarAsiento() {
    const detalles = lineas.map(l => ({
      cuentaContableId: l.cuentaContableId,
      debe: parseFloat(l.debe) || 0,
      haber: parseFloat(l.haber) || 0,
    })).filter(d => d.cuentaContableId > 0 && (d.debe > 0 || d.haber > 0))

    if (!concepto.trim()) { error('El concepto es requerido'); return }
    if (detalles.length < 2) { error('Debe haber al menos 2 líneas (debe y haber)'); return }

    const totalDebe = detalles.reduce((s, d) => s + d.debe, 0)
    const totalHaber = detalles.reduce((s, d) => s + d.haber, 0)
    if (Math.abs(totalDebe - totalHaber) > 0.01) {
      error(`La suma del debe (${fmt(totalDebe)}) no coincide con el haber (${fmt(totalHaber)})`)
      return
    }

    createMutation.mutate({ fecha, concepto: concepto.trim(), detalles })
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Asientos Contables</h1>
          <p className="text-sm text-slate-500 mt-0.5">Registro de movimientos contables (partida doble)</p>
        </div>
        <Button onClick={abrirNuevoAsiento}><Plus size={15} /> Nuevo asiento</Button>
      </div>

      {/* ── Filtros ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Input label="Desde" type="date" value={desde} onChange={e => setDesde(e.target.value)} />
        <Input label="Hasta" type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
      </div>

      {/* ── Tabla ─────────────────────────────────────────────── */}
      {isLoading && <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>}
      {isError && <EmptyState variant="error" onRetry={refetch} />}
      {!isLoading && !isError && asientos?.length === 0 && <EmptyState title="No hay asientos en este período" />}

      {asientos && asientos.length > 0 && (
        <Card>
          <CardBody className="!p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">Concepto</th>
                    <th className="py-2.5 px-3">Usuario</th>
                    <th className="py-2.5 px-3 text-right">Debe</th>
                    <th className="py-2.5 px-3 text-right">Haber</th>
                    <th className="py-2.5 px-3 text-center">Líneas</th>
                    <th className="py-2.5 px-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {asientos.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 text-xs text-slate-500 whitespace-nowrap">{fmtFecha(a.fecha)}</td>
                      <td className="py-2 px-3 text-sm text-slate-800 font-medium max-w-xs truncate">{a.concepto}</td>
                      <td className="py-2 px-3 text-xs text-slate-500">{a.usuarioNombre}</td>
                      <td className="py-2 px-3 text-right text-sm font-mono text-slate-700">{fmt(a.totalDebe)}</td>
                      <td className="py-2 px-3 text-right text-sm font-mono text-slate-700">{fmt(a.totalHaber)}</td>
                      <td className="py-2 px-3 text-center text-xs text-slate-500">{a.totalDetalles}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => abrirDetalle(a.id)} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-brand-600" title="Ver detalle"><Eye size={14} /></button>
                          <button onClick={() => { if (confirm('¿Desactivar este asiento?')) deleteMutation.mutate(a.id) }} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-red-600" title="Desactivar"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ── Modal detalle ──────────────────────────────────── */}
      {asientoId && asientoData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setAsientoId(null); setAsientoData(null) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-800">Asiento #{asientoData.id}</h3>
              <button onClick={() => { setAsientoId(null); setAsientoData(null) }} className="p-1 rounded-lg hover:bg-slate-100">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-5 py-3 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Fecha:</span><span className="text-slate-800 font-medium">{fmtFecha(asientoData.fecha)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Concepto:</span><span className="text-slate-800 font-medium text-right max-w-xs">{asientoData.concepto}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Usuario:</span><span className="text-slate-800">{asientoData.usuarioNombre}</span></div>
              {asientoData.referenciaTipo && (
                <div className="flex justify-between"><span className="text-slate-500">Referencia:</span><span className="text-slate-800">{asientoData.referenciaTipo} #{asientoData.referenciaId}</span></div>
              )}
            </div>
            <div className="border-t border-slate-100 mx-5" />
            <div className="px-5 py-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                    <th className="pb-2">Cuenta</th>
                    <th className="pb-2 text-right">Debe</th>
                    <th className="pb-2 text-right">Haber</th>
                  </tr>
                </thead>
                <tbody>
                  {asientoData.detalles.map(d => (
                    <tr key={d.id} className="border-b border-slate-50">
                      <td className="py-1.5"><span className="font-mono text-slate-400">{d.codigoCuenta}</span> <span className="text-slate-700">{d.nombreCuenta}</span></td>
                      <td className="py-1.5 text-right font-mono text-slate-700">{d.debe > 0 ? fmt(d.debe) : '-'}</td>
                      <td className="py-1.5 text-right font-mono text-slate-700">{d.haber > 0 ? fmt(d.haber) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold text-slate-800">
                    <td className="pt-2">Totales</td>
                    <td className="pt-2 text-right font-mono">{fmt(asientoData.detalles.reduce((s, d) => s + d.debe, 0))}</td>
                    <td className="pt-2 text-right font-mono">{fmt(asientoData.detalles.reduce((s, d) => s + d.haber, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal crear asiento ─────────────────────────────── */}
      {showCrear && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-8 overflow-y-auto" onClick={(e) => { if (e.target === e.currentTarget) setShowCrear(false) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-800"><FileText size={15} className="inline mr-1.5" />Nuevo asiento contable</h3>
              <button onClick={() => setShowCrear(false)} className="p-1 rounded-lg hover:bg-slate-100">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
              <Input label="Concepto" value={concepto} onChange={e => setConcepto(e.target.value)} placeholder="Ej: Venta del día, Pago a proveedor..." />
              <Input label="Fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
              <div className="border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Movimientos</span>
                  <Button variant="ghost" size="sm" onClick={addLinea}><Plus size={13} /> Agregar línea</Button>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                      <th className="pb-2 w-1/2">Cuenta</th>
                      <th className="pb-2 w-[22%] text-right">Debe</th>
                      <th className="pb-2 w-[22%] text-right">Haber</th>
                      <th className="pb-2 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {lineas.map((l, i) => (
                      <tr key={i}>
                        <td className="py-1 pr-1">
                          <select
                            value={l.cuentaContableId}
                            onChange={e => updateLinea(i, 'cuentaContableId', parseInt(e.target.value))}
                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-brand-500"
                          >
                            <option value={0}>Seleccionar cuenta...</option>
                            {cuentas.map(c => (
                              <option key={c.id} value={c.id}>{c.codigo} — {c.nombre}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-1 px-1">
                          <input type="number" step="0.01" min="0" placeholder="0.00" value={l.debe}
                            onChange={e => updateLinea(i, 'debe', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-right font-mono outline-none focus:border-brand-500" />
                        </td>
                        <td className="py-1 px-1">
                          <input type="number" step="0.01" min="0" placeholder="0.00" value={l.haber}
                            onChange={e => updateLinea(i, 'haber', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-right font-mono outline-none focus:border-brand-500" />
                        </td>
                        <td className="py-1 pl-1">
                          {lineas.length > 1 && (
                            <button onClick={() => removeLinea(i)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 size={13} /></button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold text-slate-700 text-[11px] border-t border-slate-100">
                      <td className="pt-2">Totales</td>
                      <td className="pt-2 text-right font-mono">{fmt(lineas.reduce((s, l) => s + (parseFloat(l.debe) || 0), 0))}</td>
                      <td className="pt-2 text-right font-mono">{fmt(lineas.reduce((s, l) => s + (parseFloat(l.haber) || 0), 0))}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100">
              <Button variant="ghost" onClick={() => setShowCrear(false)}>Cancelar</Button>
              <Button onClick={guardarAsiento} loading={createMutation.isPending}>Crear asiento</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
