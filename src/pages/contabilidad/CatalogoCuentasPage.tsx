import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Plus, Edit, Trash2, ChevronRight, ChevronDown, RefreshCw } from 'lucide-react'
import { cuentasContablesApi } from '../../api'
import { Card, CardBody } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import Input from '../../components/ui/Input'
import { useToast, errMsg } from '../../context/ToastContext'
import type { CuentaContableTree, CuentaContableResponse, TipoCuenta, CreateCuentaContableDto, UpdateCuentaContableDto } from '../../types'

const fmtDate = () => new Date().toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' })

const TIPO_COLOR: Record<TipoCuenta, 'green' | 'red' | 'blue' | 'yellow' | 'orange'> = {
  Activo: 'green',
  Pasivo: 'red',
  Patrimonio: 'blue',
  Ingreso: 'yellow',
  Gasto: 'orange',
}

function TreeItem({
  cuenta,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onAddChild,
  nivel,
}: {
  cuenta: CuentaContableTree
  expanded: Record<number, boolean>
  onToggle: (id: number) => void
  onEdit: (c: CuentaContableTree) => void
  onDelete: (c: CuentaContableTree) => void
  onAddChild: (c: CuentaContableTree) => void
  nivel: number
}) {
  const hasChildren = cuenta.subCuentas.length > 0
  const isOpen = expanded[cuenta.id]

  return (
    <>
      <tr className="group hover:bg-slate-50/50 cursor-default">
        <td className="py-1.5 pr-2 w-6">
          {hasChildren ? (
            <button onClick={() => onToggle(cuenta.id)} className="p-0.5 rounded hover:bg-slate-200 transition-colors">
              {isOpen ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
            </button>
          ) : (
            <span className="inline-block w-4" />
          )}
        </td>
        <td className="py-1.5 pr-3 font-mono text-xs text-slate-500 whitespace-nowrap">{cuenta.codigo}</td>
        <td className="py-1.5 pr-3 text-sm text-slate-800" style={{ paddingLeft: `${nivel * 16}px` }}>
          <span className="font-medium">{cuenta.nombre}</span>
          {cuenta.descripcion && <span className="ml-2 text-xs text-slate-400">{cuenta.descripcion}</span>}
        </td>
        <td className="py-1.5 pr-3"><Badge color={TIPO_COLOR[cuenta.tipo]}>{cuenta.tipoLabel}</Badge></td>
        <td className="py-1.5 pr-3 text-xs text-slate-400">{cuenta.nivel}</td>
        <td className="py-1.5">
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onAddChild(cuenta)} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-brand-600" title="Agregar subcuenta">
              <Plus size={14} />
            </button>
            <button onClick={() => onEdit(cuenta)} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-brand-600" title="Editar">
              <Edit size={14} />
            </button>
            <button onClick={() => onDelete(cuenta)} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-red-600" title="Desactivar">
              <Trash2 size={14} />
            </button>
          </div>
        </td>
      </tr>
      {isOpen && hasChildren && (
        cuenta.subCuentas.map(hijo => (
          <TreeItem
            key={hijo.id}
            cuenta={hijo}
            expanded={expanded}
            onToggle={onToggle}
            onEdit={onEdit}
            onDelete={onDelete}
            onAddChild={onAddChild}
            nivel={nivel + 1}
          />
        ))
      )}
    </>
  )
}

export default function CatalogoCuentasPage() {
  const qc = useQueryClient()
  const { success, error } = useToast()

  const [expanded, setExpanded] = useState<Record<number, boolean>>({})

  // Modal de formulario
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<CuentaContableTree | CuentaContableResponse | null>(null)
  const [padreId, setPadreId] = useState<number | null | undefined>(undefined)
  const [form, setForm] = useState<CreateCuentaContableDto>({ codigo: '', nombre: '', descripcion: '', tipo: 'Activo', nivel: 1, cuentaPadreId: null })

  // Modal de confirmación eliminar
  const [deleteTarget, setDeleteTarget] = useState<CuentaContableTree | null>(null)

  const { data: arbol, isLoading, isError, refetch } = useQuery({
    queryKey: ['cuentas-contables', 'arbol'],
    queryFn: () => cuentasContablesApi.getTree(),
  })

  // Inicializar plan por defecto
  const initMutation = useMutation({
    mutationFn: () => cuentasContablesApi.inicializar(),
    onSuccess: (res) => {
      success(res.mensaje)
      qc.invalidateQueries({ queryKey: ['cuentas-contables'] })
    },
    onError: (e) => error(errMsg(e)),
  })

  // Crear cuenta
  const createMutation = useMutation({
    mutationFn: (dto: CreateCuentaContableDto) => cuentasContablesApi.create(dto),
    onSuccess: () => {
      success('Cuenta creada correctamente')
      setModalOpen(false)
      qc.invalidateQueries({ queryKey: ['cuentas-contables'] })
    },
    onError: (e) => error(errMsg(e)),
  })

  // Actualizar cuenta
  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: UpdateCuentaContableDto }) => cuentasContablesApi.update(id, dto),
    onSuccess: () => {
      success('Cuenta actualizada correctamente')
      setModalOpen(false)
      qc.invalidateQueries({ queryKey: ['cuentas-contables'] })
    },
    onError: (e) => error(errMsg(e)),
  })

  // Eliminar (desactivar)
  const deleteMutation = useMutation({
    mutationFn: (id: number) => cuentasContablesApi.delete(id),
    onSuccess: () => {
      success('Cuenta desactivada')
      setDeleteTarget(null)
      qc.invalidateQueries({ queryKey: ['cuentas-contables'] })
    },
    onError: (e) => error(errMsg(e)),
  })

  const toggleExpand = useCallback((id: number) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }, [])

  // Generar código sugerido para subcuenta
  const getSugeridoCodigo = useCallback((padre: CuentaContableTree) => {
    const hijos = padre.subCuentas
    const maxHijo = hijos.reduce((max, h) => {
      const partes = h.codigo.split('.')
      const num = parseInt(partes[partes.length - 1] || '0', 10)
      return num > max ? num : max
    }, 0)
    return `${padre.codigo}.${String(maxHijo + 1).padStart(2, '0')}`
  }, [])

  // ── Handlers ─────────────────────────────────────────────────────────────
  function abrirNueva(padre?: CuentaContableTree) {
    const nivel = padre ? padre.nivel + 1 : 1
    setForm({ codigo: padre ? getSugeridoCodigo(padre) : '', nombre: '', descripcion: '', tipo: padre ? padre.tipo : 'Activo', nivel, cuentaPadreId: padre ? padre.id : null })
    setPadreId(padre?.id ?? null)
    setEditando(null)
    setModalOpen(true)
  }

  function abrirEditar(cuenta: CuentaContableTree) {
    setForm({ codigo: cuenta.codigo, nombre: cuenta.nombre, descripcion: cuenta.descripcion || '', tipo: cuenta.tipo, nivel: cuenta.nivel, cuentaPadreId: cuenta.cuentaPadreId })
    setPadreId(undefined)
    setEditando(cuenta)
    setModalOpen(true)
  }

  function guardar() {
    if (!form.codigo.trim() || !form.nombre.trim()) return

    if (editando) {
      updateMutation.mutate({ id: editando.id, dto: { codigo: form.codigo, nombre: form.nombre, descripcion: form.descripcion, tipo: form.tipo, activo: true } })
    } else {
      createMutation.mutate(form)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Catálogo de Cuentas</h1>
          <p className="text-sm text-slate-500 mt-0.5">{fmtDate()} • Plan Único de Cuentas</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw size={15} />
          </Button>
          <Button variant="secondary" onClick={() => abrirNueva()}>
            <Plus size={15} /> Nueva cuenta
          </Button>
          <Button onClick={() => initMutation.mutate()} loading={initMutation.isPending}>
            <BookOpen size={15} /> Inicializar plan
          </Button>
        </div>
      </div>

      {/* ── Loading / Error / Empty ──────────────────────────── */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {isError && (
        <EmptyState variant="error" title="Error al cargar cuentas" onRetry={refetch} />
      )}
      {!isLoading && !isError && (!arbol || arbol.length === 0) && (
        <div>
          <EmptyState
            title="No hay cuentas contables"
            description="Usa el botón 'Inicializar plan' para crear el plan de cuentas por defecto o agrega cuentas manualmente."
          />
          <div className="flex justify-center gap-2 -mt-4">
            <Button variant="primary" onClick={() => initMutation.mutate()} loading={initMutation.isPending}>
              <BookOpen size={15} /> Inicializar plan por defecto
            </Button>
            <Button variant="secondary" onClick={() => abrirNueva()}>
              <Plus size={15} /> Agregar manual
            </Button>
          </div>
        </div>
      )}

      {/* ── Tree table ───────────────────────────────────────── */}
      {!isLoading && !isError && arbol && arbol.length > 0 && (
        <Card>
          <CardBody className="!p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-3 w-6" />
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-3">Nombre</th>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3">Nivel</th>
                    <th className="py-2.5 px-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {arbol.map(cuenta => (
                    <TreeItem
                      key={cuenta.id}
                      cuenta={cuenta}
                      expanded={expanded}
                      onToggle={toggleExpand}
                      onEdit={abrirEditar}
                      onDelete={(c) => setDeleteTarget(c)}
                      onAddChild={(c) => abrirNueva(c)}
                      nivel={0}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ── Modal formulario ────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-800">{editando ? 'Editar cuenta' : 'Nueva cuenta'}</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded-lg hover:bg-slate-100">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {padreId !== undefined && !editando && (
                <div className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                  Cuenta padre ID: {padreId ?? 'Ninguna (raíz)'}
                </div>
              )}
              <Input
                label="Código"
                value={form.codigo}
                onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))}
                placeholder="Ej: 5.2.17"
                disabled={!!editando}
              />
              <Input
                label="Nombre"
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Nombre de la cuenta"
              />
              <Input
                label="Descripción (opcional)"
                value={form.descripcion || ''}
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                placeholder="Breve descripción"
              />
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
                <select
                  value={form.tipo}
                  onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoCuenta }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                >
                  <option value="Activo">Activo</option>
                  <option value="Pasivo">Pasivo</option>
                  <option value="Patrimonio">Patrimonio</option>
                  <option value="Ingreso">Ingreso</option>
                  <option value="Gasto">Gasto</option>
                </select>
              </div>
              <Input
                label="Nivel"
                type="number"
                min={1}
                max={6}
                value={form.nivel}
                onChange={e => setForm(f => ({ ...f, nivel: parseInt(e.target.value) || 1 }))}
                disabled={!!editando}
              />
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button onClick={guardar} loading={createMutation.isPending || updateMutation.isPending}>
                {editando ? 'Guardar cambios' : 'Crear cuenta'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal confirmar eliminar ─────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-800">¿Desactivar cuenta?</h3>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-slate-600">
                Se desactivará la cuenta <strong>{deleteTarget.codigo} — {deleteTarget.nombre}</strong>.
                Las subcuentas deben desactivarse primero.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100">
              <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
              <Button variant="danger" onClick={() => deleteMutation.mutate(deleteTarget.id)} loading={deleteMutation.isPending}>
                Desactivar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
