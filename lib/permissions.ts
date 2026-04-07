import { ROLE_DEFAULT_PERMISSIONS, type AppRole, type Permission } from '@/types'

const LEGACY_PERMISSION_ALIASES: Partial<Record<Permission, Permission[]>> = {
  'cash.view': ['view_caja'],
  'cash.open': ['edit_caja'],
  'cash.close': ['edit_caja'],
  'cash.add_movement': ['edit_caja'],
  'cash.export': ['view_caja'],
}

export function getRolePermissions(role: AppRole, explicitPermissions?: Permission[]) {
  if (role === 'superadmin') {
    return [...ROLE_DEFAULT_PERMISSIONS.superadmin]
  }

  if (explicitPermissions && explicitPermissions.length > 0) {
    return explicitPermissions
  }

  return ROLE_DEFAULT_PERMISSIONS[role] ?? []
}

export function hasResolvedPermission(role: AppRole, permissions: Permission[], permission: Permission) {
  if (role === 'superadmin') return true

  const grantedPermissions = getRolePermissions(role, permissions)
  if (grantedPermissions.includes(permission)) return true

  return (LEGACY_PERMISSION_ALIASES[permission] ?? []).some(alias => grantedPermissions.includes(alias))
}
