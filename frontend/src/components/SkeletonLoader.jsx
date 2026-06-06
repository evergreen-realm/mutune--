import React from 'react';

export function Skeleton({ className, ...props }) {
  return (
    <div
      className={`animate-pulse rounded bg-gray-200/80 ${className}`}
      {...props}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg border p-4 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
      <div className="h-8 bg-gray-200 rounded w-2/3 mb-2" />
      <div className="h-3 bg-gray-200 rounded w-full" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="bg-white rounded-lg border overflow-hidden animate-pulse">
      <div className="bg-gray-50 p-4 border-b">
        <div className="h-4 bg-gray-200 rounded w-1/4" />
      </div>
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="p-4 border-b last:border-0 flex gap-4">
          <div className="h-4 bg-gray-200 rounded w-24" />
          <div className="h-4 bg-gray-200 rounded w-48" />
          <div className="h-4 bg-gray-200 rounded w-32" />
          <div className="h-4 bg-gray-200 rounded w-16 ml-auto" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonMap() {
  return <div className="h-96 bg-gray-100 rounded-lg animate-pulse" />;
}

export function StatCardSkeleton() {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-8 w-16 mt-1" />
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
                <Skeleton className="h-4 w-16" />
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
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-[330px] rounded-lg w-full" />
    </div>
  );
}

export default function SkeletonLoader({ type = 'card', ...props }) {
  if (type === 'table') return <SkeletonTable {...props} />;
  if (type === 'map') return <SkeletonMap {...props} />;
  return <SkeletonCard {...props} />;
}
