interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

/** Simple prev/next pager for the list envelope every module returns. */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: PaginationProps): React.JSX.Element | null {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) {
    return null;
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="text-muted mt-3 flex items-center justify-between text-xs">
      <span>
        {from}&ndash;{to} of {total}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => {
            onPageChange(page - 1);
          }}
          className="border-line hover:bg-line/60 rounded-md border px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <span>
          Page {page} of {pageCount}
        </span>
        <button
          type="button"
          disabled={page >= pageCount}
          onClick={() => {
            onPageChange(page + 1);
          }}
          className="border-line hover:bg-line/60 rounded-md border px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
