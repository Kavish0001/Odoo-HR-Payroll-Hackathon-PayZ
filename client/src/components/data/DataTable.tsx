import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { useState, type ReactNode } from 'react';

import { cn } from '../../lib/utils.js';

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: readonly T[];
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  onRowClick?: (row: T) => void;
  getRowId?: (row: T) => string;
  skeletonRows?: number;
  /** Extra classes for a given row, e.g. to make a "running" contract obvious. */
  rowClassName?: (row: T) => string | undefined;
}

const SORT_GLYPH: Record<'asc' | 'desc', string> = { asc: '▲', desc: '▼' };

/**
 * TanStack Table wrapper every list screen renders through, so sorting,
 * loading skeletons and empty/error states look and behave the same
 * everywhere instead of being reinvented per module.
 */
export function DataTable<T>({
  columns,
  data,
  isLoading = false,
  isError = false,
  errorMessage = 'Something went wrong while loading this list.',
  emptyTitle = 'No records found',
  emptyDescription = 'Try adjusting your filters, or add a new record.',
  emptyAction,
  onRowClick,
  getRowId,
  skeletonRows = 6,
  rowClassName,
}: DataTableProps<T>): React.JSX.Element {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: data as T[],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    ...(getRowId !== undefined ? { getRowId } : {}),
  });

  const columnCount = columns.length;
  const showSkeleton = isLoading;
  const showError = !isLoading && isError;
  const showEmpty = !isLoading && !isError && data.length === 0;
  const showRows = !isLoading && !isError && data.length > 0;

  return (
    <div className="border-line bg-raised overflow-hidden rounded-lg border">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-surface border-line border-b">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className="text-muted px-4 py-2.5 text-xs font-medium tracking-wide uppercase"
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="hover:text-ink inline-flex items-center gap-1"
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {sorted !== false && (
                            <span aria-hidden="true">{SORT_GLYPH[sorted]}</span>
                          )}
                        </button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {showSkeleton &&
              Array.from({ length: skeletonRows }).map((_, rowIndex) => (
                <tr
                  key={`skeleton-${String(rowIndex)}`}
                  className="border-line border-b last:border-0"
                >
                  {columns.map((_column, colIndex) => (
                    <td key={colIndex} className="px-4 py-3">
                      <div className="bg-line/60 h-4 w-full max-w-40 animate-pulse rounded" />
                    </td>
                  ))}
                </tr>
              ))}

            {showError && (
              <tr>
                <td colSpan={columnCount} className="px-4 py-10 text-center">
                  <p className="text-danger text-sm font-medium">
                    {errorMessage}
                  </p>
                </td>
              </tr>
            )}

            {showEmpty && (
              <tr>
                <td colSpan={columnCount} className="px-4 py-10 text-center">
                  <p className="text-sm font-medium">{emptyTitle}</p>
                  <p className="text-muted mt-1 text-xs">{emptyDescription}</p>
                  {emptyAction !== undefined && (
                    <div className="mt-3 flex justify-center">
                      {emptyAction}
                    </div>
                  )}
                </td>
              </tr>
            )}

            {showRows &&
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={
                    onRowClick !== undefined
                      ? () => {
                          onRowClick(row.original);
                        }
                      : undefined
                  }
                  className={cn(
                    'border-line border-b last:border-0',
                    onRowClick !== undefined &&
                      'hover:bg-surface cursor-pointer',
                    rowClassName?.(row.original),
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
