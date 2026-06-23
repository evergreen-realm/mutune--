import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import EmptyState from './EmptyState';

/**
 * DataTable — Production-grade data table inspired by 21st.dev / shadcn patterns.
 *
 * @prop {Array} columns — [{ key, header, render?, sortable?, className? }]
 * @prop {Array} data
 * @prop {boolean} isLoading
 * @prop {number} skeletonRows — rows to show during loading
 * @prop {string} emptyTitle
 * @prop {string} emptyDescription
 * @prop {Function} onRowClick
 * @prop {string} rowKey — key field for React key, defaults to '_id'
 */
export default function DataTable({
  columns = [],
  data = [],
  isLoading = false,
  skeletonRows = 5,
  emptyTitle = 'No records found',
  emptyDescription = '',
  emptyIcon,
  onRowClick,
  rowKey = '_id',
  className = '',
}) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === 'string') {
        return sortConfig.direction === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [data, sortConfig]);

  const SortIcon = ({ colKey }) => {
    if (sortConfig.key !== colKey) {
      return <ChevronsUpDown size={12} className="text-gray-500" />;
    }
    return sortConfig.direction === 'asc' ? (
      <ChevronUp size={12} className="text-emerald-600" />
    ) : (
      <ChevronDown size={12} className="text-emerald-600" />
    );
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div
        className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${className}`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                {columns.map((col) => (
                  <th key={col.key} className="px-4 py-3">
                    <div className="h-3.5 w-16 bg-gray-200/80 rounded animate-pulse" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: skeletonRows }).map((_, rowIdx) => (
                <tr key={rowIdx} className="border-b border-gray-50 last:border-0">
                  {columns.map((col, colIdx) => (
                    <td key={col.key} className="px-4 py-3.5">
                      <div
                        className={`h-3.5 bg-gray-200/60 rounded animate-pulse ${
                          colIdx === 1 ? 'w-36' : 'w-20'
                        }`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Empty state
  if (!data.length) {
    return (
      <div
        className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${className}`}
      >
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
        />
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${className}`}
    >
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-100">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={[
                    'px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500',
                    col.sortable ? 'cursor-pointer select-none hover:text-gray-700' : '',
                    col.className || '',
                  ].join(' ')}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <div className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && <SortIcon colKey={col.key} />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, idx) => (
              <motion.tr
                key={row[rowKey] || idx}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.02, duration: 0.2 }}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={[
                  'border-b border-gray-50 last:border-0',
                  'transition-colors duration-100',
                  onRowClick
                    ? 'cursor-pointer hover:bg-emerald-50/30'
                    : 'hover:bg-gray-50/50',
                ].join(' ')}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 text-gray-700 ${col.className || ''}`}
                  >
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
