import React, { forwardRef, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
  isTextarea?: boolean;
  rows?: number;
  className?: string;
}

const Input = forwardRef<HTMLInputElement & HTMLTextAreaElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftAddon,
      rightAddon,
      isTextarea = false,
      className = '',
      id: externalId,
      rows = 3,
      ...props
    },
    ref
  ) => {
    const autoId = useId();
    const id = externalId || autoId;
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;

    const describedBy = [
      error ? errorId : null,
      helperText ? helperId : null,
    ]
      .filter(Boolean)
      .join(' ') || undefined;

    const inputClasses = [
      'w-full bg-white text-gray-900 text-sm',
      'border border-gray-200 rounded-lg',
      'placeholder:text-gray-500',
      'transition-all duration-150 ease-out',
      'focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500',
      'hover:border-gray-300',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50',
      'dark:bg-slate-950 dark:border-slate-800 dark:text-white',
      error
        ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500'
        : '',
      leftAddon ? 'pl-10' : 'pl-3',
      rightAddon ? 'pr-10' : 'pr-3',
      isTextarea ? 'py-2.5 resize-none' : 'h-10',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const Tag = isTextarea ? 'textarea' : 'input';

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
          {leftAddon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
              {leftAddon}
            </div>
          )}

          <Tag
            ref={ref as any}
            id={id}
            rows={isTextarea ? rows : undefined}
            className={inputClasses}
            aria-invalid={!!error || undefined}
            aria-describedby={describedBy}
            {...(props as any)}
          />

          {rightAddon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-500">
              {rightAddon}
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {error ? (
            <motion.p
              key="error"
              id={errorId}
              role="alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="text-xs text-red-500 flex items-center gap-1 font-medium"
            >
              <svg
                className="h-3.5 w-3.5 shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              {error}
            </motion.p>
          ) : helperText ? (
            <p id={helperId} className="text-xs text-gray-500">
              {helperText}
            </p>
          ) : null}
        </AnimatePresence>
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
