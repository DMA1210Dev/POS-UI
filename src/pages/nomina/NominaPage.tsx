import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import {
  Search, User, Wallet, Building, Calculator, Info,
  AlertTriangle, ChevronRight, ChevronDown, Briefcase, Hash,
  FileSpreadsheet, Loader, BookOpen,
} from 'lucide-react'
import api from '../../lib/axios'
import { Card, CardHeader, CardBody } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import { useToast, errMsg } from '../../context/ToastContext'
import type { EmpleadoListDto, NominaResponse } from '../../types'

const fmt = (n: number) =>
  `RD$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const NUM = (n: number) =>
  Number(n.toFixed(2))

function useEmpleados() {
  const [empleados, setEmpleados] = useState<EmpleadoListDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    api.get<EmpleadoListDto[]>('/empleados', { params: { soloActivos: true } })
      .then(r => setEmpleados(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  return { empleados, loading, error }
}

export default function NominaPage() {
  const { empleados, loading: loadingEmp, error: errorEmp } = useEmpleados()
  const { success, error: toastError } = useToast()
  const [search, setSearch] = useState('')
  const [empleadoId, setEmpleadoId] = useState<number | null>(null)
  const [nomina, setNomina] = useState<NominaResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [contabilizando, setContabilizando] = useState(false)

  const filtrados = empleados.filter(e =>
    !search || e.nombre.toLowerCase().includes(search.toLowerCase())
  )

  async function consultar(id: number) {
    setLoading(true)
    setError('')
    setNomina(null)
    try {
      const r = await api.get<NominaResponse>(`/nomina/${id}`)
      setNomina(r.data)
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error al calcular nómina')
    } finally {
      setLoading(false)
    }
  }

  // ── Exportar empleado actual ──────────────────────────────────────────────
  function exportarNomina() {
    if (!nomina) return
    const n = nomina
    const rows = [
      { Concepto: 'Salario bruto mensual',              Valor: NUM(n.empleado.salarioBrutoMensual) },
      { Concepto: '', Valor: '' },
      { Concepto: 'BASES COTIZABLES', Valor: '' },
      { Concepto: 'Base AFP',                           Valor: NUM(n.basesCotizables.baseAFP) },
      { Concepto: 'Base SFS',                           Valor: NUM(n.basesCotizables.baseSFS) },
      { Concepto: 'Base SRL',                           Valor: NUM(n.basesCotizables.baseSRL) },
      { Concepto: '', Valor: '' },
      { Concepto: 'DESCUENTOS DEL EMPLEADO', Valor: '' },
      { Concepto: 'AFP (2.87%)',                        Valor: -NUM(n.descuentosEmpleado.afpEmpleado) },
      { Concepto: 'SFS (3.04%)',                        Valor: -NUM(n.descuentosEmpleado.sfsEmpleado) },
      { Concepto: 'ISR',                                Valor: -NUM(n.descuentosEmpleado.isrMensual) },
      ...(n.descuentosEmpleado.otrosDescuentosEmpleado > 0
        ? [{ Concepto: 'Otros descuentos', Valor: -NUM(n.descuentosEmpleado.otrosDescuentosEmpleado) }]
        : []),
      { Concepto: 'TOTAL DESC',                         Valor: -NUM(n.descuentosEmpleado.totalDescuentosEmpleado) },
      { Concepto: 'SALARIO NETO',                       Valor: NUM(n.descuentosEmpleado.salarioNeto) },
      { Concepto: '', Valor: '' },
      { Concepto: 'APORTES DE LA EMPRESA', Valor: '' },
      { Concepto: 'AFP (7.10%)',                        Valor: NUM(n.aportesEmpresa.afpEmpresa) },
      { Concepto: 'SFS (7.09%)',                        Valor: NUM(n.aportesEmpresa.sfsEmpresa) },
      { Concepto: 'Riesgo laboral',                     Valor: NUM(n.aportesEmpresa.riesgoLaboralEmpresa) },
      { Concepto: 'INFOTEP (1.00%)',                    Valor: NUM(n.aportesEmpresa.infotepEmpresa) },
      { Concepto: 'TOTAL APORTES',                      Valor: NUM(n.aportesEmpresa.totalAportesEmpresa) },
      { Concepto: 'COSTO TOTAL EMPRESA',                Valor: NUM(n.aportesEmpresa.costoTotalEmpresa) },
      { Concepto: '', Valor: '' },
      { Concepto: 'DETALLE ISR', Valor: '' },
      { Concepto: 'Salario gravable mensual',           Valor: NUM(n.detalleISR.salarioGravableMensual) },
      { Concepto: 'Salario gravable anual',             Valor: NUM(n.detalleISR.salarioGravableAnual) },
      { Concepto: 'ISR anual estimado',                 Valor: NUM(n.detalleISR.isrAnual) },
      { Concepto: 'ISR mensual',                        Valor: -NUM(n.detalleISR.isrMensual) },
      { Concepto: `Tramo: ${n.detalleISR.tramoAplicado}`, Valor: '' },
    ]

    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 40 }, { wch: 18 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Nómina')
    XLSX.writeFile(wb, `Nomina_${n.empleado.nombre.replace(/\s+/g, '_')}.xlsx`)
  }

  // ── Contabilizar nómina ──────────────────────────────────────────────────
  async function contabilizarNomina() {
    if (!empleadoId) return
    setContabilizando(true)
    try {
      const r = await api.post(`/nomina/${empleadoId}/contabilizar`)
      success(`Asiento #${r.data.asientoId} generado — ${r.data.mensaje}`)
    } catch (e: any) {
      toastError(errMsg(e))
    } finally {
      setContabilizando(false)
    }
  }

  // ── Exportar todos los empleados ──────────────────────────────────────────
  async function exportarTodas() {
    setExportando(true)
    const datos: Record<string, string | number>[] = []

    for (const emp of empleados) {
      try {
        const r = await api.get<NominaResponse>(`/nomina/${emp.id}`)
        const n = r.data
        if (!n.empleado.idEmpleado) continue
        datos.push({
          Empleado:          n.empleado.nombre,
          Posición:          n.empleado.posicion ?? '',
          Departamento:      n.empleado.departamento ?? '',
          'Salario Bruto':   NUM(n.empleado.salarioBrutoMensual),
          'Base AFP':        NUM(n.basesCotizables.baseAFP),
          'Base SFS':        NUM(n.basesCotizables.baseSFS),
          'Base SRL':        NUM(n.basesCotizables.baseSRL),
          'AFP Emp.':        -NUM(n.descuentosEmpleado.afpEmpleado),
          'SFS Emp.':        -NUM(n.descuentosEmpleado.sfsEmpleado),
          'ISR Mensual':     -NUM(n.descuentosEmpleado.isrMensual),
          'Otros Desc.':     -NUM(n.descuentosEmpleado.otrosDescuentosEmpleado),
          'Total Desc.':     -NUM(n.descuentosEmpleado.totalDescuentosEmpleado),
          'Salario Neto':     NUM(n.descuentosEmpleado.salarioNeto),
          'AFP Empresa':      NUM(n.aportesEmpresa.afpEmpresa),
          'SFS Empresa':      NUM(n.aportesEmpresa.sfsEmpresa),
          'Riesgo Laboral':   NUM(n.aportesEmpresa.riesgoLaboralEmpresa),
          'INFOTEP':          NUM(n.aportesEmpresa.infotepEmpresa),
          'Total Aportes':    NUM(n.aportesEmpresa.totalAportesEmpresa),
          'Costo Total':      NUM(n.aportesEmpresa.costoTotalEmpresa),
        })
      } catch {
        // skip employees that error
      }
    }

    if (datos.length === 0) {
      setExportando(false)
      return
    }

    const ws = XLSX.utils.json_to_sheet(datos)
    ws['!cols'] = [
      { wch: 25 }, { wch: 20 }, { wch: 18 },
      { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 14 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 14 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Nómina General')
    XLSX.writeFile(wb, 'Nomina_General.xlsx')
    setExportando(false)
  }

  return (
    <div className="h-[calc(100vh-6rem)] flex gap-6">
      {/* ── Left panel — employee list ──────────────────────────────────── */}
      <aside className="w-80 shrink-0 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-4 border-b border-slate-100 shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Briefcase size={16} className="text-brand-600" />
              Empleados
            </h2>
            <button
              onClick={exportarTodas}
              disabled={exportando || empleados.length === 0}
              className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors disabled:opacity-30 disabled:pointer-events-none"
              title="Exportar nómina general a Excel"
            >
              {exportando
                ? <Loader size={15} className="animate-spin" />
                : <FileSpreadsheet size={15} />
              }
            </button>
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar empleado..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition-colors"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingEmp ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : errorEmp ? (
            <EmptyState variant="error" title="Error al cargar empleados" />
          ) : filtrados.length === 0 ? (
            <EmptyState variant="empty" title={search ? 'Sin resultados' : 'No hay empleados'} description={search ? 'Prueba con otro término de búsqueda' : 'Registra empleados primero'} />
          ) : (
            <div className="divide-y divide-slate-100">
              {filtrados.map(e => {
                const isSel = e.id === empleadoId
                return (
                  <button
                    key={e.id}
                    onClick={() => { setEmpleadoId(e.id); consultar(e.id) }}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      isSel
                        ? 'bg-brand-50 border-l-4 border-l-brand-500'
                        : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${isSel ? 'text-brand-700' : 'text-slate-700'}`}>
                        {e.nombre}
                      </span>
                      <ChevronRight size={14} className={`${isSel ? 'text-brand-500' : 'text-slate-300'}`} />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-400">{e.posicion ?? '—'}</span>
                      {e.departamento && (
                        <Badge color="blue">{e.departamento}</Badge>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </aside>

      {/* ── Right panel — nomina breakdown ──────────────────────────────── */}
      <main className="flex-1 flex flex-col gap-4 min-w-0 overflow-y-auto">
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-500">Calculando nómina...</p>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="flex items-start gap-2 bg-danger-50 border border-danger-200 rounded-xl px-4 py-3">
            <AlertTriangle size={16} className="text-danger-500 shrink-0 mt-0.5" />
            <p className="text-sm text-danger-700">{error}</p>
          </div>
        )}

        {nomina?.validaciones.map((v, i) => (
          <div key={i} className="flex items-start gap-2 bg-warning-50 border border-warning-200 rounded-xl px-4 py-3">
            <Info size={16} className="text-warning-500 shrink-0 mt-0.5" />
            <p className="text-sm text-warning-700">{v}</p>
          </div>
        ))}

        {nomina && (
          <>
            {/* ── Header summary ─────────────────────────────────────────── */}
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center">
                    <User size={16} className="text-brand-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{nomina.empleado.nombre}</p>
                    <p className="text-xs text-slate-400">{nomina.empleado.posicion ?? '—'} · {nomina.empleado.departamento ?? '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={exportarNomina}>
                    <FileSpreadsheet size={14} />
                    Excel
                  </Button>
                  <Button variant="secondary" size="sm" onClick={contabilizarNomina} loading={contabilizando}>
                    <BookOpen size={14} />
                    Contabilizar
                  </Button>
                  <Badge color="blue">{nomina.empleado.anioFiscal}</Badge>
                </div>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-brand-50 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-brand-600 uppercase tracking-wide mb-1">Salario Bruto</p>
                    <p className="font-bold text-brand-700 text-lg">{fmt(nomina.empleado.salarioBrutoMensual)}</p>
                  </div>
                  <div className="bg-success-50 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-success-600 uppercase tracking-wide mb-1">Salario Neto</p>
                    <p className="font-bold text-success-700 text-lg">{fmt(nomina.descuentosEmpleado.salarioNeto)}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Costo Empresa</p>
                    <p className="font-bold text-slate-800 text-lg">{fmt(nomina.aportesEmpresa.costoTotalEmpresa)}</p>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* ── Bases cotizables ────────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Hash size={15} className="text-slate-500" />
                  <span className="text-sm font-semibold text-slate-800">Bases cotizables</span>
                </div>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-3 gap-3">
                  <StatBox label="Base AFP" value={fmt(nomina.basesCotizables.baseAFP)} palette="blue" />
                  <StatBox label="Base SFS" value={fmt(nomina.basesCotizables.baseSFS)} palette="blue" />
                  <StatBox label="Base SRL" value={fmt(nomina.basesCotizables.baseSRL)} palette="blue" />
                </div>
              </CardBody>
            </Card>

            {/* ── Descuentos del empleado ──────────────────────────────────── */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Wallet size={15} className="text-slate-500" />
                  <span className="text-sm font-semibold text-slate-800">Descuentos del empleado</span>
                </div>
              </CardHeader>
              <CardBody>
                <div className="space-y-3">
                  <NcRow label="AFP (2.87%)" value={fmt(nomina.descuentosEmpleado.afpEmpleado)} />
                  <NcRow label="SFS (3.04%)" value={fmt(nomina.descuentosEmpleado.sfsEmpleado)} />
                  <NcRow label="ISR" value={fmt(nomina.descuentosEmpleado.isrMensual)} />
                  {nomina.descuentosEmpleado.otrosDescuentosEmpleado > 0 && (
                    <NcRow label="Otros descuentos" value={fmt(nomina.descuentosEmpleado.otrosDescuentosEmpleado)} />
                  )}
                  <div className="border-t border-slate-100 pt-2">
                    <NcRow label="Total descuentos" value={fmt(nomina.descuentosEmpleado.totalDescuentosEmpleado)} bold />
                  </div>
                  <div className="bg-success-50 rounded-xl px-3 py-2 flex justify-between items-center">
                    <span className="text-xs font-medium text-success-600">Salario neto</span>
                    <span className="font-bold text-success-700">{fmt(nomina.descuentosEmpleado.salarioNeto)}</span>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* ── Aportes de la empresa ─────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Building size={15} className="text-slate-500" />
                  <span className="text-sm font-semibold text-slate-800">Aportes de la empresa</span>
                  <Badge color="yellow">No descuentan al empleado</Badge>
                </div>
              </CardHeader>
              <CardBody>
                <div className="space-y-3">
                  <NcRow label="AFP (7.10%)" value={fmt(nomina.aportesEmpresa.afpEmpresa)} />
                  <NcRow label="SFS (7.09%)" value={fmt(nomina.aportesEmpresa.sfsEmpresa)} />
                  <NcRow label="Riesgo laboral" value={fmt(nomina.aportesEmpresa.riesgoLaboralEmpresa)} />
                  <NcRow label="INFOTEP (1.00%)" value={fmt(nomina.aportesEmpresa.infotepEmpresa)} />
                  <div className="border-t border-slate-100 pt-2">
                    <NcRow label="Total aportes" value={fmt(nomina.aportesEmpresa.totalAportesEmpresa)} bold />
                  </div>
                  <div className="bg-brand-50 rounded-xl px-3 py-2 flex justify-between items-center">
                    <span className="text-xs font-medium text-brand-600">Costo total para la empresa</span>
                    <span className="font-bold text-brand-700">{fmt(nomina.aportesEmpresa.costoTotalEmpresa)}</span>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* ── Detalle ISR ──────────────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Calculator size={15} className="text-slate-500" />
                  <span className="text-sm font-semibold text-slate-800">Detalle ISR</span>
                </div>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <StatBox label="Gravable mensual" value={fmt(nomina.detalleISR.salarioGravableMensual)} palette="blue" />
                  <StatBox label="Gravable anual" value={fmt(nomina.detalleISR.salarioGravableAnual)} palette="blue" />
                  <StatBox label="ISR anual" value={fmt(nomina.detalleISR.isrAnual)} palette="orange" />
                  <StatBox label="ISR mensual" value={fmt(nomina.detalleISR.isrMensual)} palette="orange" />
                </div>
                <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
                  <Info size={13} className="text-slate-400 shrink-0" />
                  <span className="text-xs text-slate-600"><strong>Tramo:</strong> {nomina.detalleISR.tramoAplicado}</span>
                </div>
              </CardBody>
            </Card>

            {/* ── Explicación (colapsable) ─────────────────────────────────── */}
            <Card>
              <button
                onClick={() => setExpanded(e => !e)}
                className="w-full text-left"
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Info size={15} className="text-slate-500" />
                      <span className="text-sm font-semibold text-slate-800">Explicación</span>
                    </div>
                    <ChevronDown
                      size={16}
                      className={`text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-0' : '-rotate-90'}`}
                    />
                  </div>
                </CardHeader>
              </button>
              {expanded && (
                <CardBody>
                  <p className="text-sm text-slate-600 mb-4 leading-relaxed">{nomina.explicacion.resumen}</p>
                  <div className="space-y-2">
                    <ExpItem title="AFP" text={nomina.explicacion.afpEmpleado} />
                    <ExpItem title="SFS" text={nomina.explicacion.sfsEmpleado} />
                    <ExpItem title="ISR" text={nomina.explicacion.isr} />
                    <ExpItem title="Aportes empresa" text={nomina.explicacion.aportesEmpresa} />
                    <ExpItem title="Costo total" text={nomina.explicacion.costoTotalEmpresa} />
                  </div>
                </CardBody>
              )}
            </Card>
          </>
        )}

        {!loading && !nomina && !error && (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              variant="empty"
              title="Selecciona un empleado"
              description="Elige un empleado de la lista para ver su desglose de nómina completo."
            />
          </div>
        )}
      </main>
    </div>
  )
}

/* ── Sub-components ────────────────────────────────────────────────────────── */

type Palette = 'blue' | 'orange' | 'red' | 'green'
const paletteMap: Record<Palette, { bg: string; label: string; value: string }> = {
  blue:   { bg: 'bg-brand-50',  label: 'text-brand-600',  value: 'text-brand-700' },
  orange: { bg: 'bg-warning-50', label: 'text-warning-600', value: 'text-warning-700' },
  red:    { bg: 'bg-danger-50',  label: 'text-danger-600',  value: 'text-danger-700' },
  green:  { bg: 'bg-success-50', label: 'text-success-600', value: 'text-success-700' },
}

function StatBox({ label, value, palette = 'blue' }: { label: string; value: string; palette?: Palette }) {
  const p = paletteMap[palette]
  return (
    <div className={`${p.bg} rounded-xl p-3 text-center`}>
      <p className={`text-[10px] ${p.label} uppercase tracking-wide mb-1`}>{label}</p>
      <p className={`font-bold ${p.value} text-sm`}>{value}</p>
    </div>
  )
}

function NcRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm ${bold ? 'font-bold text-slate-800' : 'font-medium text-slate-700'}`}>{value}</span>
    </div>
  )
}

function ExpItem({ title, text }: { title: string; text: string }) {
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5">
      <p className="text-xs font-semibold text-slate-600 mb-0.5">{title}</p>
      <p className="text-xs text-slate-500 leading-relaxed">{text}</p>
    </div>
  )
}
