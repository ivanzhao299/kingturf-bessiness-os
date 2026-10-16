import { hasPermissionPrefix } from '../shared/permission-prefix';
import type { GovernanceActionContext } from './workspace-types';
import { createGovernanceRoleButtons } from './identity-role-buttons';
import { createGovernanceAccountButtons } from './identity-account-buttons';
import { createGovernanceGrantButton } from './identity-grant-button';
import { appendGovernanceIdentityState } from './identity-state';
import { appendGovernanceRevokeGrant } from './identity-revoke-grant';
import { appendGovernanceIdentityScopes } from './identity-scopes';
export function appendGovernanceIdentityActions(context: GovernanceActionContext) {
  const { surface, permissions, actions } = context;
  if (
    surface.id === 'identity-access' &&
    (permissions.has('authorization:manage') ||
      hasPermissionPrefix(permissions, [
        'identity:manage',
        'role:manage',
        'permission:manage',
        'role-assignment:manage',
        'data-scope:manage',
      ]))
  ) {
    const legacyManage = permissions.has('authorization:manage');
    const mayManageIdentity = legacyManage || permissions.has('identity:manage');
    const mayManageRoles = legacyManage || permissions.has('role:manage');
    const mayManageAssignments = legacyManage || permissions.has('role-assignment:manage');
    const mayManageScopes = legacyManage || permissions.has('data-scope:manage');
    const { role, assignment } = createGovernanceRoleButtons(context);
    const { identity, unassignment } = createGovernanceAccountButtons(context);
    const { grant } = createGovernanceGrantButton(context);
    if (mayManageRoles) actions.append(role, grant);
    if (mayManageIdentity) actions.append(identity);
    if (mayManageAssignments) actions.append(assignment, unassignment);
    appendGovernanceIdentityState(context, mayManageIdentity);
    appendGovernanceRevokeGrant(context, mayManageRoles);
    appendGovernanceIdentityScopes(context, mayManageScopes);
  }
}
