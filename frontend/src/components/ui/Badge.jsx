import React from 'react';

/**
 * Badge — Status-aware badge component inspired by 21st.dev / shadcn patterns.
 *
 * @prop {'success'|'warning'|'danger'|'info'|'neutral'|'pending'} status
 * @prop {'sm'|'md'} size
 * @prop {boolean} dot — show pulsing dot indicator
 * @prop {boolean} outline — outline variant
 */
const statusClasses = {
  success:
    'bg-emerald-50 text-emerald-700 border-emerald-200/60',
  warning:
    'bg-amber-50 text-amber-700 border-amber-200/60',
  danger:
    'bg-red-50 text-red-700 border-red-200/60',
  info:
    'bg-blue-50 text-blue-700 border-blue-200/60',
  neutral:
    'bg-gray-50 text-gray-600 border-gray-200/60',
  pending:
    'bg-purple-50 text-purple-700 border-purple-200/60',
};

const dotColors = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger:  'bg-red-500',
  info:    'bg-blue-500',
  neutral: 'bg-gray-400',
  pending: 'bg-purple-500',
};

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-xs px-2.5 py-1',
};

export default function Badge({
  status = 'neutral',
  size = 'md',
  dot = false,
  outline = false,
  children,
  className = '',
  ...props
}) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full font-bold border select-none',
        'transition-colors duration-150',
        statusClasses[status],
        sizeClasses[size],
        outline ? 'bg-transparent' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {dot && (
        <span className="relative flex h-2 w-2">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColors[status]}`}
          />
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${dotColors[status]}`}
          />
        </span>
      )}
      {children}
    </span>
  );
}
