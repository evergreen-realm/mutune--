import React, { forwardRef, useId } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: SelectOption[];
  placeholder?: string;
  className?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      options = [],
      placeholder = 'Select...',
      className = '',
      id: externalId,
      children,
      ...props
    },
    ref
  ) => {
    const autoId = useId();
    const id = externalId || autoId;

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={id}
            className="text-sm font-medium text-gray-700 dark:text-gray-300 select-none"
          >
            {label}
          </label>
        )}

        <div className="relative">
          <select
            ref={ref}
            id={id}
            className={[
              'w-full h-10 pl-3 pr-10 bg-white text-gray-900 text-sm',
              'border border-gray-200 rounded-lg appearance-none',
              'transition-all duration-150 ease-out',
              'focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500',
              'hover:border-gray-300',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50',
              'dark:bg-slate-950 dark:border-slate-800 dark:text-white',
              error
                ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500'
                : '',
              className,
            ]
              .filter(Boolean)
              .join(' ')}
            aria-invalid={!!error || undefined}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {children
              ? children
              : options.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.disabled}
                  >
                    {opt.label}
                  </option>
                ))}
          </select>

          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
            <ChevronDown size={16} />
          </div>
        </div>

        {error ? (
          <p className="text-xs text-red-500 font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-gray-500">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';
export default Select;
