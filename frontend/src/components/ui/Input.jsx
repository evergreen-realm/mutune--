import React, { forwardRef, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Input — Production-grade input component inspired by 21st.dev / shadcn patterns.
 *
 * @prop {string} label
 * @prop {string} error
 * @prop {string} helperText
 * @prop {React.ReactNode} leftAddon
 * @prop {React.ReactNode} rightAddon
 * @prop {boolean} isTextarea
 */
const Input = forwardRef(
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
      'placeholder:text-gray-400',
      'transition-all duration-150 ease-out',
      'focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500',
      'hover:border-gray-300',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50',
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

    const InputElement = isTextarea ? 'textarea' : 'input';

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
          {leftAddon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              {leftAddon}
            </div>
          )}

          <motion.div
            animate={error ? { x: [0, -4, 4, -2, 2, 0] } : {}}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
          >
            <InputElement
              ref={ref}
              id={id}
              className={inputClasses}
              aria-invalid={!!error || undefined}
              aria-describedby={describedBy}
              rows={isTextarea ? rows : undefined}
              {...props}
            />
          </motion.div>

          {rightAddon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {rightAddon}
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {error && (
            <motion.p
              key="error"
              id={errorId}
              initial={{ opacity: 0, y: -4, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -4, height: 0 }}
              className="text-xs font-medium text-red-500"
              role="alert"
            >
              {error}
            </motion.p>
          )}
          {!error && helperText && (
            <motion.p
              key="helper"
              id={helperId}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-gray-400"
            >
              {helperText}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
