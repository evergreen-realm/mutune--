import React from 'react';
import { motion } from 'framer-motion';

export type SpinnerSize = 'sm' | 'md' | 'lg';

export interface SpinnerProps {
  size?: SpinnerSize;
  label?: string;
  overlay?: boolean;
  className?: string;
}

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-10 w-10',
};

function SpinnerIcon({ size = 'md', className = '' }: { size?: SpinnerSize; className?: string }) {
  return (
    <motion.svg
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
      className={`${sizeClasses[size]} text-emerald-600 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        className="opacity-20"
        cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="3"
      />
      <path
        d="M12 2a10 10 0 019.8 8"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </motion.svg>
  );
}

export default function Spinner({
  size = 'md',
  label = 'Loading...',
  overlay = false,
  className = '',
}: SpinnerProps) {
  if (overlay) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <SpinnerIcon size="lg" />
          <span className="text-sm text-gray-400 font-medium">{label}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <SpinnerIcon size={size} />
      {label && <span className="text-xs text-gray-500 font-medium">{label}</span>}
    </div>
  );
}
