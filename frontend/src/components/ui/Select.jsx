import React, { forwardRef, useId } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Select — Styled native select with consistent design. Inspired by 21st.dev / shadcn.
 *
 * @prop {string} label
 * @prop {string} error
 * @prop {string} helperText
 * @prop {Array} options — [{ value, label, disabled? }]
 * @prop {string} placeholder
 */
const Select = forwardRef(
  (
    {
      label,
      error,
      helperText,
      options = [],
      placeholder = 'Select...',
      className = '',
      id: externalId,
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
            className="text-sm font-medium text-gray-700 select-none"
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
            {options.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
              >
                {opt.label}
              </option>
            ))}
          </select>

          <ChevronDown
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
        </div>

        {error && (
          <p className="text-xs font-medium text-red-500" role="alert">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p className="text-xs text-gray-400">{helperText}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
export default Select;
