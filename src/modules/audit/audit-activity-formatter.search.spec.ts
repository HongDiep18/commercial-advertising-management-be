import { AuditActivityFormatter } from './audit-activity-formatter';

describe('AuditActivityFormatter.findActionsByTitleSearch', () => {
  it('matches activity titles case-insensitively', () => {
    const actions = AuditActivityFormatter.findActionsByTitleSearch(
      'profile request submitted',
    );
    expect(actions).toContain('profile_request.created');
  });

  it('returns empty array for blank search', () => {
    expect(AuditActivityFormatter.findActionsByTitleSearch('   ')).toEqual([]);
  });
});
