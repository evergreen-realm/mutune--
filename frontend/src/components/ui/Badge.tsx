import React from 'react';

export type BadgeStatus = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'pending';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: BadgeStatus;
  size?: BadgeSize;
  dot?: boolean;
  outline?: boolean;
  children?: React.ReactNode;
  className?: string;
}

const statusClasses: Record<BadgeStatus, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40',
  warning: 'bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40',
  danger:  'bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/40',
  info:    'bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40',
  neutral: 'bg-gray-50 text-gray-600 border-gray-200/60 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800',
  pending: 'bg-purple-50 text-purple-700 border-purple-200/60 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40',
};

const dotColors: Record<BadgeStatus, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger:  'bg-red-500',
  info:    'bg-blue-500',
  neutral: 'bg-gray-400',
  pending: 'bg-purple-500',
};

const sizeClasses: Record<BadgeSize, string> = {
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
}: BadgeProps) {
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
        <span
          className={`h-1.5 w-1.5 rounded-full ${dotColors[status]} animate-pulse`}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
