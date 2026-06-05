import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { FileSpreadsheet, Loader, Users, DollarSign, Building, AlertTriangle, X } from 'lucide-react'
import api from '../../lib/axios'
import { Card, CardHeader, CardBody } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import Badge from '../../components/ui/Badge'
import type { NominaGeneralResponse } from '../../types'

const fmt = (n: number) =>
  `RD$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function NominaGeneralPage() {
  const [data, setData] = useState<NominaGeneralResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [conceptoModal, setConceptoModal] = useState<{
    titulo: string
    items: { label: string; value: number; quien: string }[]
    total: number
  } | null>(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    setError('')
    try {
      const r = await api.get<NominaGeneralResponse>('/nomina/general')
      setData(r.data)
    } catch {
      setError('Error al cargar nómina general')
    } finally {
      setLoading(false)
    }
  }

  function exportar() {
    if (!data) return
    const rows = data.nominas.map(n => ({
      Empleado:         n.empleado.nombre,
      Cédula:           n.empleado.cedula ?? '',
      Posición:         n.empleado.posicion ?? '',
      Departamento:     n.empleado.departamento ?? '',
      'Cuenta Banco':   n.empleado.cuentaBanco ?? '',
      'Salario Bruto':  Number(n.empleado.salarioBrutoMensual.toFixed(2)),
      'AFP':            Number(n.descuentosEmpleado.afpEmpleado.toFixed(2)),
      'SFS':            Number(n.descuentosEmpleado.sfsEmpleado.toFixed(2)),
      'ISR':            Number(n.descuentosEmpleado.isrMensual.toFixed(2)),
      'Otros Desc.':    Number(n.descuentosEmpleado.otrosDescuentosEmpleado.toFixed(2)),
      'Total Desc.':    Number(n.descuentosEmpleado.totalDescuentosEmpleado.toFixed(2)),
      'Salario Neto':   Number(n.descuentosEmpleado.salarioNeto.toFixed(2)),
      'Costo Empresa':  Number(n.aportesEmpresa.costoTotalEmpresa.toFixed(2)),
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 25 }, { wch: 18 }, { wch: 20 }, { wch: 15 }, { wch: 22 },
      { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Nómina General')
    XLSX.writeFile(wb, 'Nomina_General.xlsx')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-6rem)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Calculando nómina general...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 max-w-5xl mx-auto">
        <div className="flex items-start gap-2 bg-danger-50 border border-danger-200 rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="text-danger-500 shrink-0 mt-0.5" />
          <p className="text-sm text-danger-700">{error}</p>
        </div>
      </div>
    )
  }

  if (!data || data.cantidadEmpleados === 0) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-6rem)]">
        <EmptyState
          variant="empty"
          title="Sin datos de nómina"
          description="No hay empleados activos con salario registrado para calcular."
        />
      </div>
    )
  }

  const NUM = (n: number) => Number(n.toFixed(2))

  return (
    <div className="h-[calc(100vh-6rem)] p-4 flex flex-col gap-4">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Users size={22} className="text-brand-600" />
          Nómina General
        </h1>
        <Button variant="secondary" size="sm" onClick={exportar}>
          <FileSpreadsheet size={14} />
          Exportar Excel
        </Button>
      </div>

      {/* ── Summary cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4 shrink-0">
        <div className="bg-brand-50 rounded-xl p-4 text-center">
          <p className="text-[10px] text-brand-600 uppercase tracking-wide mb-1">Empleados</p>
          <p className="font-bold text-brand-700 text-2xl">{data.cantidadEmpleados}</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-4 text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Total Salario Bruto</p>
          <p className="font-bold text-slate-800 text-lg">{fmt(data.totalSalarioBruto)}</p>
        </div>
        <div className="bg-success-50 rounded-xl p-4 text-center">
          <p className="text-[10px] text-success-600 uppercase tracking-wide mb-1">Total a Pagar (Neto)</p>
          <p className="font-bold text-success-700 text-lg">{fmt(data.totalSalarioNeto)}</p>
        </div>
        <div className="bg-warning-50 rounded-xl p-4 text-center">
          <p className="text-[10px] text-warning-600 uppercase tracking-wide mb-1">Costo Total Empresa</p>
          <p className="font-bold text-warning-700 text-lg">{fmt(data.totalCostoEmpresa)}</p>
        </div>
      </div>

      {/* ── Tabla de empleados (flex-1 con scroll) ──────────────────────── */}
      <Card className="flex flex-col overflow-hidden min-h-0 flex-1">
        <CardHeader className="shrink-0">
          <div className="flex items-center gap-2">
            <DollarSign size={15} className="text-slate-500" />
            <span className="text-sm font-semibold text-slate-800">Detalle de pagos</span>
            <Badge color="blue">{data.cantidadEmpleados} empleados</Badge>
          </div>
        </CardHeader>
        <div className="overflow-auto flex-1 min-h-0">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-medium">Empleado</th>
                    <th className="text-left px-4 py-3 font-medium">Cédula</th>
                    <th className="text-left px-4 py-3 font-medium">Dpto.</th>
                    <th className="text-left px-4 py-3 font-medium">Cuenta Banco</th>
                <th className="text-right px-4 py-3 font-medium">Bruto</th>
                <th className="text-right px-4 py-3 font-medium">AFP</th>
                <th className="text-right px-4 py-3 font-medium">SFS</th>
                <th className="text-right px-4 py-3 font-medium">ISR</th>
                <th className="text-right px-4 py-3 font-medium">Desc.</th>
                <th className="text-right px-4 py-3 font-medium text-success-600">Neto a Pagar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.nominas.map(n => (
                <tr key={n.empleado.idEmpleado} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{n.empleado.nombre}</p>
                    <p className="text-xs text-slate-400">{n.empleado.posicion ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-slate-500">{n.empleado.cedula ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{n.empleado.departamento ?? '—'}</td>
                  <td className="px-4 py-3">
                    {n.empleado.cuentaBanco ? (
                      <span className="font-mono text-xs text-slate-600 bg-slate-100 rounded px-1.5 py-0.5">
                        {n.empleado.cuentaBanco}
                      </span>
                    ) : (
                      <span className="text-xs text-danger-400">Sin cuenta</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-700">{fmt(NUM(n.empleado.salarioBrutoMensual))}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{fmt(NUM(n.descuentosEmpleado.afpEmpleado))}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{fmt(NUM(n.descuentosEmpleado.sfsEmpleado))}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{fmt(NUM(n.descuentosEmpleado.isrMensual))}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{fmt(NUM(n.descuentosEmpleado.totalDescuentosEmpleado))}</td>
                  <td className="px-4 py-3 text-right font-bold text-success-700">{fmt(NUM(n.descuentosEmpleado.salarioNeto))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 bg-white z-10">
              <tr className="border-t-2 border-slate-200 bg-slate-50/50 text-sm font-semibold text-slate-800">
                <td className="px-4 py-3" colSpan={4}>Totales</td>
                <td className="px-4 py-3 text-right">{fmt(NUM(data.totalSalarioBruto))}</td>
                <td className="px-4 py-3 text-right text-slate-500">{fmt(NUM(data.nominas.reduce((s, n) => s + n.descuentosEmpleado.afpEmpleado, 0)))}</td>
                <td className="px-4 py-3 text-right text-slate-500">{fmt(NUM(data.nominas.reduce((s, n) => s + n.descuentosEmpleado.sfsEmpleado, 0)))}</td>
                <td className="px-4 py-3 text-right text-slate-500">{fmt(NUM(data.nominas.reduce((s, n) => s + n.descuentosEmpleado.isrMensual, 0)))}</td>
                <td className="px-4 py-3 text-right text-slate-500">{fmt(NUM(data.nominas.reduce((s, n) => s + n.descuentosEmpleado.totalDescuentosEmpleado, 0)))}</td>
                <td className="px-4 py-3 text-right text-success-700">{fmt(NUM(data.totalSalarioNeto))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* ── Resumen de pagos a entidades (click para detalle) ──────────── */}
      <Card className="shrink-0">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building size={15} className="text-slate-500" />
            <span className="text-sm font-semibold text-slate-800">Resumen de pagos a entidades</span>
            <Badge color="yellow">Haz clic para ver detalle</Badge>
          </div>
        </CardHeader>
        <CardBody>
          {(() => {
            const sum = (sel: (n: typeof data.nominas[number]) => number) =>
              NUM(data.nominas.reduce((s, n) => s + sel(n), 0))

            const afpEmp  = sum(n => n.descuentosEmpleado.afpEmpleado)
            const afpEmpresa = sum(n => n.aportesEmpresa.afpEmpresa)
            const sfsEmp  = sum(n => n.descuentosEmpleado.sfsEmpleado)
            const sfsEmpresa = sum(n => n.aportesEmpresa.sfsEmpresa)
            const isr     = sum(n => n.descuentosEmpleado.isrMensual)
            const riesgo  = sum(n => n.aportesEmpresa.riesgoLaboralEmpresa)
            const infotep = sum(n => n.aportesEmpresa.infotepEmpresa)

            const conceptos = [
              {
                key: 'AFP',
                label: 'AFP',
                total: NUM(afpEmp + afpEmpresa),
                items: [
                  { label: 'Empleado (2.87%)', value: afpEmp, quien: 'Empleado' },
                  { label: 'Empresa (7.10%)', value: afpEmpresa, quien: 'Empresa' },
                ],
                color: 'bg-brand-50' as const,
                textColor: 'text-brand-700' as const,
                labelColor: 'text-brand-600' as const,
              },
              {
                key: 'SFS',
                label: 'SFS',
                total: NUM(sfsEmp + sfsEmpresa),
                items: [
                  { label: 'Empleado (3.04%)', value: sfsEmp, quien: 'Empleado' },
                  { label: 'Empresa (7.09%)', value: sfsEmpresa, quien: 'Empresa' },
                ],
                color: 'bg-sky-50' as const,
                textColor: 'text-sky-700' as const,
                labelColor: 'text-sky-600' as const,
              },
              {
                key: 'ISR',
                label: 'ISR',
                total: isr,
                items: [
                  { label: 'Empleado', value: isr, quien: 'Empleado' },
                ],
                color: 'bg-orange-50' as const,
                textColor: 'text-orange-700' as const,
                labelColor: 'text-orange-600' as const,
              },
              {
                key: 'RIESGO',
                label: 'Riesgo laboral',
                total: riesgo,
                items: [
                  { label: 'Empresa', value: riesgo, quien: 'Empresa' },
                ],
                color: 'bg-rose-50' as const,
                textColor: 'text-rose-700' as const,
                labelColor: 'text-rose-600' as const,
              },
              {
                key: 'INFOTEP',
                label: 'INFOTEP',
                total: infotep,
                items: [
                  { label: 'Empresa (1.00%)', value: infotep, quien: 'Empresa' },
                ],
                color: 'bg-violet-50' as const,
                textColor: 'text-violet-700' as const,
                labelColor: 'text-violet-600' as const,
              },
            ]

            const totalEntidades = conceptos.reduce((s, c) => s + c.total, 0)

            return (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {conceptos.map(c => (
                  <button
                    key={c.key}
                    onClick={() => setConceptoModal({ titulo: c.label, items: c.items, total: c.total })}
                    className={`${c.color} rounded-xl p-3 text-center cursor-pointer hover:shadow-sm transition-shadow text-left`}
                  >
                    <p className={`text-[10px] ${c.labelColor} uppercase tracking-wide mb-1`}>{c.label}</p>
                    <p className={`font-bold ${c.textColor} text-sm`}>{fmt(c.total)}</p>
                  </button>
                ))}
                <div className="bg-slate-800 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-slate-300 uppercase tracking-wide mb-1">Total entidades</p>
                  <p className="font-bold text-white text-sm">{fmt(totalEntidades)}</p>
                </div>
              </div>
            )
          })()}
        </CardBody>
      </Card>

      {/* ── Modal detalle de concepto ─────────────────────────────────────── */}
      {conceptoModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setConceptoModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-800">{conceptoModal.titulo}</h3>
              <button onClick={() => setConceptoModal(null)} className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
                <X size={16} className="text-slate-400" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {conceptoModal.items.map(item => (
                <div key={item.label} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{item.label}</p>
                    <p className="text-xs text-slate-400">Paga: {item.quien}</p>
                  </div>
                  <span className="font-bold text-slate-800">{fmt(item.value)}</span>
                </div>
              ))}
              <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800">Total</span>
                <span className="font-bold text-brand-700">{fmt(conceptoModal.total)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
