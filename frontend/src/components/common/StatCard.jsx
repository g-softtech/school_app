/**
 * StatCard — reusable stat tile with icon, value, label and optional trend
 * color variants: blue | green | red | orange | purple | primary | gray
 */
const COLOR_MAP = {
  blue:    { bg: 'bg-blue-50',    icon: 'text-blue-600',    value: 'text-blue-700'    },
  green:   { bg: 'bg-green-50',   icon: 'text-green-600',   value: 'text-green-700'   },
  red:     { bg: 'bg-red-50',     icon: 'text-red-500',     value: 'text-red-600'     },
  orange:  { bg: 'bg-orange-50',  icon: 'text-orange-600',  value: 'text-orange-700'  },
  purple:  { bg: 'bg-purple-50',  icon: 'text-purple-600',  value: 'text-purple-700'  },
  primary: { bg: 'bg-primary-50', icon: 'text-primary-600', value: 'text-primary-700' },
  gray:    { bg: 'bg-secondary-100', icon: 'text-secondary-500', value: 'text-secondary-700' },
};

export default function StatCard({ title, value, icon: Icon, color = 'primary', trend, trendLabel, onClick }) {
  const c = COLOR_MAP[color] || COLOR_MAP.primary;

  return (
    <div
      className={`card flex items-center gap-4 hover:shadow-card-md hover:-translate-y-px transition-all duration-200 ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {/* Icon */}
      <div className={`w-12 h-12 rounded-xl ${c.bg} flex items-center justify-center flex-shrink-0`}>
        {Icon && <Icon size={22} className={c.icon} />}
      </div>

      {/* Text */}
      <div className="min-w-0">
        <p className="text-xs text-secondary-500 font-medium truncate">{title}</p>
        <p className={`text-2xl font-bold mt-0.5 ${c.value}`}>{value ?? '—'}</p>
        {trend !== undefined && (
          <p className={`text-xs mt-0.5 font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% {trendLabel || ''}
          </p>
        )}
      </div>
    </div>
  );
}
