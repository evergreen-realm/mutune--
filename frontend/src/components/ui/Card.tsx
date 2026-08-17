import React, { forwardRef } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

export type CardVariant = 'default' | 'glass' | 'gradient' | 'elevated';

export interface CardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  variant?: CardVariant;
  hover?: boolean;
  noPadding?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export interface CardHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

export interface CardBodyProps {
  children?: React.ReactNode;
  className?: string;
}

export interface CardFooterProps {
  children?: React.ReactNode;
  className?: string;
}

const variantClasses: Record<CardVariant, string> = {
  default:
    'bg-white border border-gray-100 shadow-sm dark:bg-slate-900 dark:border-slate-800',
  glass:
    'bg-white/60 backdrop-blur-xl border border-white/20 shadow-lg shadow-gray-900/5 dark:bg-slate-900/60 dark:border-slate-800',
  gradient:
    'bg-gradient-to-br from-white to-gray-50/80 border border-gray-100/80 shadow-sm dark:from-slate-900 dark:to-slate-950 dark:border-slate-800',
  elevated:
    'bg-white border border-gray-100 shadow-md shadow-gray-900/5 dark:bg-slate-900 dark:border-slate-800',
};

type CardComponent = React.ForwardRefExoticComponent<CardProps & React.RefAttributes<HTMLDivElement>> & {
  Header: React.FC<CardHeaderProps>;
  Body: React.FC<CardBodyProps>;
  Footer: React.FC<CardFooterProps>;
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      hover = false,
      noPadding = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={
        hover
          ? { y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }
          : {}
      }
      className={[
        'rounded-2xl overflow-hidden',
        'transition-colors duration-200',
        variantClasses[variant],
        noPadding ? '' : 'p-5',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </motion.div>
  )
) as CardComponent;

Card.displayName = 'Card';

Card.Header = function CardHeader({
  title,
  subtitle,
  action,
  badge,
  className = '',
}: CardHeaderProps) {
  return (
    <div
      className={`flex items-start justify-between gap-4 pb-4 border-b border-gray-100 dark:border-slate-800 mb-4 ${className}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
            {title}
          </h3>
          {badge}
        </div>
        {subtitle && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

Card.Body = function CardBody({
  children,
  className = '',
}: CardBodyProps) {
  return <div className={className}>{children}</div>;
};

Card.Footer = function CardFooter({
  children,
  className = '',
}: CardFooterProps) {
  return (
    <div
      className={`pt-4 border-t border-gray-100 dark:border-slate-800 mt-4 flex items-center justify-between text-xs text-gray-500 ${className}`}
    >
      {children}
    </div>
  );
};

export default Card;
