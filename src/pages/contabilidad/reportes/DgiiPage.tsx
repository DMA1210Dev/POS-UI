import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { FileText, Copy, Download, AlertTriangle, CheckCircle } from 'lucide-react'
import { dgiiApi } from '../../../api'
import type { DgiiResponseDto } from '../../../types'
import { Card, CardBody, CardHeader } from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import { useToast, errMsg } from '../../../context/ToastContext'

const meses = [
  { v: 1, l: 'Enero' }, { v: 2, l: 'Febrero' }, { v: 3, l: 'Marzo' },
  { v: 4, l: 'Abril' }, { v: 5, l: 'Mayo' }, { v: 6, l: 'Junio' },
  { v: 7, l: 'Julio' }, { v: 8, l: 'Agosto' }, { v: 9, l: 'Septiembre' },
  { v: 10, l: 'Octubre' }, { v: 11, l: 'Noviembre' }, { v: 12, l: 'Diciembre' },
]

function CodeBlock({ label, text, periodo }: { label: string; text: string; periodo: string }) {
  const { success, error: toastError } = useToast()

  const copiar = () => {
    navigator.clipboard.writeText(text)
      .then(() => success(`Formato ${label} copiado`))
      .catch(() => toastError('No se pudo copiar'))
  }

  const descargar = () => {
    try {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `DGII_F_${label}_${periodo}.txt`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toastError('Error al descargar')
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Formato {label}</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={copiar}>
            <Copy size={14} /> Copiar
          </Button>
          <Button size="sm" variant="ghost" onClick={descargar}>
            <Download size={14} /> TXT
          </Button>
        </div>
      </div>
      <pre className="bg-slate-900 text-slate-100 text-xs leading-relaxed rounded-xl p-4 overflow-x-auto max-h-80 overflow-y-auto whitespace-pre-wrap break-all font-mono">
        {text || '(sin datos para este período)'}
      </pre>
    </div>
  )
}

export default function DgiiPage() {
  const { success, error } = useToast()
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [resultado, setResultado] = useState<DgiiResponseDto | null>(null)

  const mutation = useMutation({
    mutationFn: () => dgiiApi.generar(anio, mes),
    onSuccess: (res) => {
      success(`Reportes DGII para ${res.periodo}`)
      setResultado(res)
    },
    onError: (e) => error(errMsg(e)),
  })

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Reportes DGII</h1>
          <p className="text-sm text-slate-500 mt-0.5">Formatos 606, 607, 608 y 609 para envío a la DGII</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-end gap-4 flex-wrap">
            <div>
              <select value={anio} onChange={e => { setAnio(parseInt(e.target.value)); setResultado(null) }}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500">
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <select value={mes} onChange={e => { setMes(parseInt(e.target.value)); setResultado(null) }}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500">
                {meses.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
              </select>
            </div>
            <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>
              <FileText size={15} /> Generar reportes DGII
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          {mutation.isError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 mb-4">
              <AlertTriangle size={16} /> {errMsg(mutation.error)}
            </div>
          )}

          {resultado?.errores?.length > 0 && (
            <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-xl px-4 py-3 mb-4">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <ul className="list-disc pl-4">
                {resultado.errores.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {resultado && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-3">
                <CheckCircle size={18} />
                <span className="font-medium">Reportes generados para período {resultado.periodo}</span>
              </div>

              <CodeBlock label="606" text={resultado.formato606} periodo={resultado.periodo} />
              <CodeBlock label="607" text={resultado.formato607} periodo={resultado.periodo} />
              <CodeBlock label="608" text={resultado.formato608} periodo={resultado.periodo} />
              <CodeBlock label="609" text={resultado.formato609} periodo={resultado.periodo} />
            </div>
          )}

          {!resultado && !mutation.isError && (
            <p className="text-sm text-slate-400 text-center py-8">
              Selecciona un período y presiona "Generar reportes DGII" para obtener los formatos.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
