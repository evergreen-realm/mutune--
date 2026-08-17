import React, { useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ModalProps {
  open: boolean;
  onClose?: () => void;
  size?: ModalSize;
  children?: React.ReactNode;
  className?: string;
}

export interface ModalHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

export interface ModalBodyProps {
  children?: React.ReactNode;
  className?: string;
}

export interface ModalFooterProps {
  children?: React.ReactNode;
  className?: string;
}

const sizeClasses: Record<ModalSize, string> = {
  sm:   'max-w-sm',
  md:   'max-w-md',
  lg:   'max-w-lg',
  xl:   'max-w-2xl',
  full: 'max-w-[90vw] max-h-[90vh]',
};

const overlayVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1 },
};

const panelVariants = {
  hidden:  { opacity: 0, scale: 0.95, y: 10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 350, damping: 25 },
  },
  exit: { opacity: 0, scale: 0.97, y: 8, transition: { duration: 0.15 } },
};

export default function Modal({
  open,
  onClose,
  size = 'md',
  children,
  className = '',
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      onClose?.();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.2 }}
            onClick={handleBackdropClick}
            className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm"
            aria-hidden="true"
          />

          <motion.div
            ref={panelRef}
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={[
              'relative w-full z-10',
              'bg-white rounded-2xl shadow-2xl border border-gray-100',
              'overflow-hidden flex flex-col max-h-[85vh]',
              'dark:bg-slate-900 dark:border-slate-800',
              sizeClasses[size],
              className,
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

Modal.Header = function ModalHeader({
  title,
  subtitle,
  onClose,
  className = '',
}: ModalHeaderProps) {
  return (
    <div
      className={`flex items-start justify-between p-6 pb-4 border-b border-gray-100 dark:border-slate-800 ${className}`}
    >
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white leading-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
        )}
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
};

Modal.Body = function ModalBody({
  children,
  className = '',
}: ModalBodyProps) {
  return (
    <div className={`p-6 overflow-y-auto flex-1 ${className}`}>{children}</div>
  );
};

Modal.Footer = function ModalFooter({
  children,
  className = '',
}: ModalFooterProps) {
  return (
    <div
      className={`flex items-center justify-end gap-3 p-6 pt-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-950/50 ${className}`}
    >
      {children}
    </div>
  );
};
