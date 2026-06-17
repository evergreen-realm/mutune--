import React from 'react';
import { motion } from 'framer-motion';

export function Skeleton({ className, ...props }) {
  return (
    <motion.div
      className={`rounded bg-gray-200/80 ${className}`}
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut"
      }}
      {...props}
    />
  );
}

export function SkeletonText({ className, width = 'w-full', height = 'h-4', ...props }) {
  return (
    <Skeleton className={`${height} ${width} ${className}`} {...props} />
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg border p-4">
      <SkeletonText width="w-1/3" className="mb-3" />
      <SkeletonText width="w-2/3" height="h-8" className="mb-2" />
      <SkeletonText className="w-full" height="h-3" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="bg-gray-50 p-4 border-b">
        <SkeletonText width="w-1/4" />
      </div>
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="p-4 border-b last:border-0 flex gap-4">
          <SkeletonText width="w-24" />
          <SkeletonText width="w-48" />
          <SkeletonText width="w-32" />
          <SkeletonText width="w-16" className="ml-auto" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonMap() {
  return <Skeleton className="h-96 w-full rounded-lg" />;
}

export function StatCardSkeleton() {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5 rounded-full" />
        <SkeletonText width="w-24" />
      </div>
      <SkeletonText width="w-16" height="h-8" className="mt-1" />
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden w-full">
      <div className="p-4 border-b border-gray-100 flex gap-2">
        <Skeleton className="h-7 w-12 rounded-full" />
        <Skeleton className="h-7 w-20 rounded-full" />
        <Skeleton className="h-7 w-20 rounded-full" />
      </div>
      <table className="w-full text-left text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50/50">
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="p-4">
                <SkeletonText width="w-16" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex} className="border-t border-gray-100">
              {Array.from({ length: cols }).map((_, colIndex) => (
                <td key={colIndex} className="p-4">
                  <Skeleton className={`h-4 ${colIndex === 1 ? 'w-36' : 'w-20'}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MapSkeleton() {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm overflow-hidden h-[400px] flex flex-col gap-3">
      <SkeletonText width="w-48" />
      <Skeleton className="h-[330px] rounded-lg w-full" />
    </div>
  );
}

export default function SkeletonLoader({ type = 'card', ...props }) {
  if (type === 'table') return <SkeletonTable {...props} />;
  if (type === 'map') return <SkeletonMap {...props} />;
  return <SkeletonCard {...props} />;
}

