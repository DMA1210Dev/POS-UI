export interface ColoresMap {
  [key: string]: string
}

export const COLORES_DEFAULT: ColoresMap = {
  'brand-50':   '#eff6ff',
  'brand-100':  '#dbeafe',
  'brand-200':  '#bfdbfe',
  'brand-300':  '#93c5fd',
  'brand-400':  '#60a5fa',
  'brand-500':  '#3b82f6',
  'brand-600':  '#2563eb',
  'brand-700':  '#1d4ed8',

  'success-50':  '#ecfdf5',
  'success-100': '#d1fae5',
  'success-400': '#34d399',
  'success-600': '#059669',
  'success-700': '#047857',

  'warning-50':  '#fff7ed',
  'warning-100': '#ffedd5',
  'warning-200': '#fed7aa',
  'warning-400': '#fb923c',
  'warning-500': '#f97316',
  'warning-600': '#ea580c',
  'warning-700': '#c2410c',
  'warning-800': '#9a3412',

  'danger-50':  '#fef2f2',
  'danger-100': '#fee2e2',
  'danger-300': '#fca5a5',
  'danger-400': '#f87171',
  'danger-500': '#ef4444',
  'danger-600': '#dc2626',
  'danger-700': '#b91c1c',
}

export const COLORES_VARS = Object.keys(COLORES_DEFAULT)

export function parseColoresJson(json: string): ColoresMap {
  try {
    const parsed = JSON.parse(json)
    if (typeof parsed === 'object' && parsed !== null) {
      return { ...COLORES_DEFAULT, ...parsed }
    }
  } catch { /* ignore */ }
  return { ...COLORES_DEFAULT }
}

export function aplicarColores(colores: ColoresMap) {
  const root = document.documentElement
  for (const [key, value] of Object.entries(colores)) {
    root.style.setProperty(`--color-${key}`, value)
  }
}
