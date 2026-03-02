export enum Role {
  VISITOR = 'VISITOR',
  MEMBER = 'MEMBER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export const ROLE_HIERARCHY: Record<Role, number> = {
  [Role.VISITOR]: 0,
  [Role.MEMBER]: 1,
  [Role.ADMIN]: 2,
  [Role.SUPER_ADMIN]: 3,
};

export const ROLE_PERMISSIONS = {
  [Role.VISITOR]: ['browse_public_content', 'use_enterprise_search'],
  [Role.MEMBER]: [
    'browse_public_content',
    'use_enterprise_search',
    'view_company_info',
    'create_company_profile_request',
  ],
  [Role.ADMIN]: [
    'browse_public_content',
    'use_enterprise_search',
    'view_company_info',
    'approve_company_profiles',
    'reject_company_profiles',
    'approve_property_listings',
    'reject_property_listings',
    'merge_duplicate_entries',
    'verify_company_data',
    'edit_enterprise_data',
    'moderate_enterprise_data',
  ],
  [Role.SUPER_ADMIN]: [
    'browse_public_content',
    'use_enterprise_search',
    'view_company_info',
    'approve_company_profiles',
    'reject_company_profiles',
    'approve_property_listings',
    'reject_property_listings',
    'merge_duplicate_entries',
    'verify_company_data',
    'edit_enterprise_data',
    'moderate_enterprise_data',
    'system_configuration',
    'crawler_settings',
    'ai_governance',
    'update_user_roles',
  ],
};
