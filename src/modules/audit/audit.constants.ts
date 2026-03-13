export const AUDIT_ENTITY = {
  COMPANY_PROFILE_REQUEST: 'CompanyProfileRequest',
  USER: 'User',
} as const;

export const AUDIT_ACTION = {
  PROFILE_REQUEST_STATUS_CHANGED: 'profile_request.status_changed',
  SET_PASSWORD_USED: 'user.set_password_used',
  USER_ACTIVE_CHANGED: 'user.active_changed',
  USER_SOFT_DELETED: 'user.soft_deleted',
} as const;
