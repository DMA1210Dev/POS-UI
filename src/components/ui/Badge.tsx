type Color = 'green' | 'red' | 'yellow' | 'blue' | 'gray' | 'purple' | 'orange'

const colors: Record<Color, string> = {
  green:  'bg-success-100 text-success-700',
  red:    'bg-danger-100 text-danger-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  blue:   'bg-brand-100 text-brand-700',
  gray:   'bg-slate-100 text-slate-600',
  purple: 'bg-purple-100 text-purple-700',
  orange: 'bg-warning-100 text-warning-700',
}

interface BadgeProps {
  children: React.ReactNode
  color?: Color
  className?: string
}

export default function Badge({ children, color = 'gray', className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[color]} ${className}`}>
      {children}
    </span>
  )
}
