import React, { useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

/**
 * Modal — Accessible animated modal component inspired by 21st.dev / shadcn patterns.
 *
 * @prop {boolean} open
 * @prop {Function} onClose
 * @prop {'sm'|'md'|'lg'|'xl'|'full'} size
 */
const sizeClasses = {
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
}) {
  const panelRef = useRef(null);

  // Escape key handler
  const handleKeyDown = useCallback(
    (e) => {
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

  // Focus trap — focus panel on open
  useEffect(() => {
    if (open && panelRef.current) {
      panelRef.current.focus();
    }
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Overlay */}
          <motion.div
            key="modal-overlay"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            key="modal-panel"
            ref={panelRef}
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            className={[
              'relative w-full bg-white rounded-2xl shadow-2xl shadow-gray-900/10',
              'border border-gray-100',
              'max-h-[85vh] overflow-hidden flex flex-col',
              'focus:outline-none',
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

/* ── Sub-components ────────────────────────────────────────────────── */

function ModalHeader({ title, subtitle, onClose, children, className = '' }) {
  if (children) {
    return (
      <div className={`px-6 pt-5 pb-3 flex items-start justify-between ${className}`}>
        <div className="flex-1">{children}</div>
        {onClose && <CloseButton onClick={onClose} />}
      </div>
    );
  }
  return (
    <div className={`px-6 pt-5 pb-3 flex items-start justify-between ${className}`}>
      <div className="min-w-0">
        {title && (
          <h2
            className="text-lg font-bold text-gray-900"
            id="modal-title"
          >
            {title}
          </h2>
        )}
        {subtitle && (
          <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      {onClose && <CloseButton onClick={onClose} />}
    </div>
  );
}
ModalHeader.displayName = 'Modal.Header';

function ModalBody({ className = '', children }) {
  return (
    <div className={`px-6 py-4 overflow-y-auto flex-1 scrollbar-thin ${className}`}>
      {children}
    </div>
  );
}
ModalBody.displayName = 'Modal.Body';

function ModalFooter({ className = '', children }) {
  return (
    <div
      className={`px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50/50 ${className}`}
    >
      {children}
    </div>
  );
}
ModalFooter.displayName = 'Modal.Footer';

function CloseButton({ onClick }) {
  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className="p-1.5 rounded-lg text-gray-500 hover:text-gray-600 hover:bg-gray-100 transition-colors"
      aria-label="Close dialog"
    >
      <X size={18} />
    </motion.button>
  );
}

Modal.Header = ModalHeader;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;
