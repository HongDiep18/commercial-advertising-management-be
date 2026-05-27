import { Role } from '../../common/enums';

export const ADMIN_LIST_USERS_DEFAULT_PAGE = 1;
export const ADMIN_LIST_USERS_DEFAULT_LIMIT = 10;
export const ADMIN_LIST_USERS_MAX_LIMIT = 100;

export const ADMIN_LIST_USER_ROLE_FILTERS = ['admin', 'user'] as const;

export type AdminListUserRoleFilter =
  (typeof ADMIN_LIST_USER_ROLE_FILTERS)[number];

export const ADMIN_LIST_USER_ROLE_FILTER_TO_DB_ROLES: Record<
  AdminListUserRoleFilter,
  readonly Role[]
> = {
  admin: [Role.ADMIN, Role.SUPER_ADMIN],
  user: [Role.MEMBER, Role.VISITOR],
};
