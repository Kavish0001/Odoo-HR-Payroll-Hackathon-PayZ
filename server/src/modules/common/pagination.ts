import { type Paginated, type Pagination } from '@payz/shared';

/** Prisma `skip`/`take` pair for a parsed pagination query. */
export function paginationArgs(query: Pick<Pagination, 'page' | 'pageSize'>): {
  skip: number;
  take: number;
} {
  return { skip: (query.page - 1) * query.pageSize, take: query.pageSize };
}

/** Wraps a page of rows in the shared `{ rows, total, page, pageSize }` envelope. */
export function toPaginated<T>(
  rows: T[],
  total: number,
  query: Pick<Pagination, 'page' | 'pageSize'>,
): Paginated<T> {
  return { rows, total, page: query.page, pageSize: query.pageSize };
}

/**
 * A case-insensitive "contains" filter for a non-empty search term.
 *
 * Callers are expected to have already checked `search` is defined and
 * non-empty; this never returns `undefined` itself so it can be assigned
 * straight into a Prisma `where` clause under `exactOptionalPropertyTypes`.
 */
export function containsInsensitive(search: string): {
  contains: string;
  mode: 'insensitive';
} {
  return { contains: search, mode: 'insensitive' };
}
