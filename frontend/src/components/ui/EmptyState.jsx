import React from 'react';
import { motion } from 'framer-motion';
import { Inbox } from 'lucide-react';
import Button from './Button';

/**
 * EmptyState — Shown when data is absent. Inspired by 21st.dev empty-state patterns.
 *
 * @prop {React.ReactNode} icon — Lucide icon or custom SVG
 * @prop {string} title
 * @prop {string} description
 * @prop {string} actionLabel — if provided, renders a CTA button
 * @prop {Function} onAction
 */
export default function EmptyState({
  icon,
  title = 'No data yet',
  description = '',
  actionLabel,
  onAction,
  className = '',
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}
    >
      <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 mb-4">
        {icon || <Inbox className="h-8 w-8 text-gray-300" />}
      </div>

      <h3 className="text-base font-semibold text-gray-700 mb-1">{title}</h3>

      {description && (
        <p className="text-sm text-gray-400 max-w-xs mb-4">{description}</p>
      )}

      {actionLabel && onAction && (
        <Button variant="outline" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </motion.div>
  );
}
