import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';

/**
 * Card — Composable card component inspired by 21st.dev / shadcn patterns.
 *
 * Usage:
 *   <Card>
 *     <Card.Header title="Revenue" subtitle="Last 6 months" badge={<Badge>Live</Badge>} />
 *     <Card.Body>{children}</Card.Body>
 *     <Card.Footer>{actions}</Card.Footer>
 *   </Card>
 *
 * @prop {'default'|'glass'|'gradient'|'elevated'} variant
 * @prop {boolean} hover — enable hover lift effect
 * @prop {boolean} noPadding — remove inner padding (for full-bleed content)
 */
const variantClasses = {
  default:
    'bg-white border border-gray-100 shadow-sm',
  glass:
    'bg-white/60 backdrop-blur-xl border border-white/20 shadow-lg shadow-gray-900/5',
  gradient:
    'bg-gradient-to-br from-white to-gray-50/80 border border-gray-100/80 shadow-sm',
  elevated:
    'bg-white border border-gray-100 shadow-md shadow-gray-900/5',
};

const Card = forwardRef(
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
);
Card.displayName = 'Card';

/* ── Sub-components ────────────────────────────────────────────────── */

function CardHeader({ title, subtitle, badge, action, className = '', children }) {
  if (children) {
    return <div className={`mb-4 ${className}`}>{children}</div>;
  }
  return (
    <div className={`flex items-start justify-between gap-3 mb-4 ${className}`}>
      <div className="min-w-0">
        {title && (
          <h3 className="text-base font-semibold text-gray-800 truncate">
            {title}
          </h3>
        )}
        {subtitle && (
          <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {badge}
        {action}
      </div>
    </div>
  );
}
CardHeader.displayName = 'Card.Header';

function CardBody({ className = '', children }) {
  return <div className={className}>{children}</div>;
}
CardBody.displayName = 'Card.Body';

function CardFooter({ className = '', children }) {
  return (
    <div
      className={`mt-4 pt-3 border-t border-gray-100/60 flex items-center gap-2 ${className}`}
    >
      {children}
    </div>
  );
}
CardFooter.displayName = 'Card.Footer';

/* ── Stat Card variant (extracted from DashboardPage) ─────────────── */

const statIconBg = {
  blue:   'bg-blue-50 text-blue-600',
  green:  'bg-emerald-50 text-emerald-600',
  yellow: 'bg-amber-50 text-amber-600',
  brand:  'bg-emerald-50 text-emerald-600',
  red:    'bg-red-50 text-red-600',
};

const statValueColor = {
  blue:   'text-blue-700',
  green:  'text-emerald-700',
  yellow: 'text-amber-700',
  brand:  'text-emerald-700',
  red:    'text-red-700',
};

const statBorderGradient = {
  blue:   'from-blue-50 to-indigo-50/20 border-blue-100/60',
  green:  'from-green-50 to-emerald-50/20 border-green-100/60',
  yellow: 'from-amber-50 to-orange-50/20 border-amber-100/60',
  brand:  'from-emerald-50 to-green-50/20 border-green-100/60',
  red:    'from-red-50 to-rose-50/20 border-red-100/60',
};

function StatCard({ icon, label, value, subtext, color = 'brand', trend }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`p-5 rounded-2xl border shadow-sm bg-gradient-to-tr ${statBorderGradient[color]}`}
    >
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            {label}
          </span>
          <div className={`text-2xl font-black ${statValueColor[color]}`}>
            {value}
          </div>
        </div>
        <div
          className={`p-2.5 rounded-xl ${statIconBg[color]} shadow-sm`}
        >
          {icon}
        </div>
      </div>
      {(subtext || trend) && (
        <div className="text-xs text-gray-400 font-medium mt-3 border-t border-gray-100/50 pt-2 flex items-center gap-1.5">
          {trend && (
            <span
              className={`font-bold ${
                trend > 0 ? 'text-emerald-500' : trend < 0 ? 'text-red-500' : 'text-gray-400'
              }`}
            >
              {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} {Math.abs(trend)}%
            </span>
          )}
          {subtext}
        </div>
      )}
    </motion.div>
  );
}
StatCard.displayName = 'Card.Stat';

/* ── Attach sub-components ──────────────────────────────────────────── */
Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;
Card.Stat = StatCard;

export default Card;
export { StatCard };
