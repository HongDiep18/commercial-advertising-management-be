export const PROFILE_REQUESTS_DEFAULT_PAGE = 1;
export const PROFILE_REQUESTS_DEFAULT_LIMIT = 10;
export const PROFILE_REQUESTS_MAX_LIMIT = 100;
export const PROFILE_REQUESTS_DEFAULT_SORT_BY = 'createdAt';
export const PROFILE_REQUESTS_DEFAULT_SORT_ORDER = 'desc' as const;

export type ProfileRequestsListParsedQuery = {
  readonly page: number;
  readonly limit: number;
  readonly sortBy: string;
  readonly sortOrder: 'asc' | 'desc';
};

export function parseProfileRequestsListQuery(input: {
  readonly pageRaw?: string;
  readonly limitRaw?: string;
  readonly sortByRaw?: string;
  readonly sortOrderRaw?: string;
}): ProfileRequestsListParsedQuery {
  const page = Math.max(
    Number(input.pageRaw ?? PROFILE_REQUESTS_DEFAULT_PAGE) ||
      PROFILE_REQUESTS_DEFAULT_PAGE,
    1,
  );
  const limit = Math.min(
    Math.max(
      Number(input.limitRaw ?? PROFILE_REQUESTS_DEFAULT_LIMIT) ||
        PROFILE_REQUESTS_DEFAULT_LIMIT,
      1,
    ),
    PROFILE_REQUESTS_MAX_LIMIT,
  );
  const sortBy = input.sortByRaw?.trim() || PROFILE_REQUESTS_DEFAULT_SORT_BY;
  const sortOrder =
    input.sortOrderRaw === 'asc' || input.sortOrderRaw === 'desc'
      ? input.sortOrderRaw
      : PROFILE_REQUESTS_DEFAULT_SORT_ORDER;
  return { page, limit, sortBy, sortOrder };
}
