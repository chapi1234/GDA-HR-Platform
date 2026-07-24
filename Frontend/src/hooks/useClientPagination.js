import { useEffect, useMemo, useState } from "react";

/**
 * Client-side pagination for long lists.
 * @param {unknown[]} items
 * @param {number} [pageSize=10]
 * @param {unknown[]} [resetDeps] - when these change, page resets to 1
 */
export function useClientPagination(items = [], pageSize = 10, resetDeps = []) {
  const [page, setPage] = useState(1);
  const list = Array.isArray(items) ? items : [];
  const size = Math.max(1, Number(pageSize) || 10);

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, resetDeps);

  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageStart = (safePage - 1) * size;
  const pagedItems = useMemo(
    () => list.slice(pageStart, pageStart + size),
    [list, pageStart, size]
  );

  return {
    page: safePage,
    setPage,
    pageSize: size,
    total,
    totalPages,
    pageStart,
    pagedItems,
    hasPrev: safePage > 1,
    hasNext: safePage < totalPages,
    showControls: total > size,
    rangeLabel:
      total > 0
        ? `Showing ${Math.min(pageStart + 1, total)}–${Math.min(
            pageStart + size,
            total
          )} of ${total}`
        : "",
  };
}
