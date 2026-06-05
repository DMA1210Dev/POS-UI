import { forwardRef, type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-slate-700">{label}</label>
      )}
      <input
        ref={ref}
        className={`
          w-full px-3 py-2 text-sm rounded-lg border bg-white
          transition-colors outline-none
          ${error
            ? 'border-danger-400 focus:ring-2 focus:ring-danger-200'
            : 'border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-100'
          }
          disabled:bg-slate-50 disabled:text-slate-400
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-xs text-danger-600">{error}</p>}
    </div>
  )
)

Input.displayName = 'Input'
export default Input
