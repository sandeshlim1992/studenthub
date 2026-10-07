// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { i18n } from '#shared/i18n/index.ts'

// Student Hub: permissions and team access of roles, for the new UI's Roles page
// (GET /api/v1/studenthub/roles; saved with Zammad's /api/v1/roles).

export interface RolePermission {
  id: number
  name: string
  label: string
  description: string
  disabled: boolean
  required: string[]
  groups: boolean
}

export type GroupAccess = 'read' | 'create' | 'change' | 'overview' | 'full'

export interface RoleRow {
  id: number
  name: string
  note: string | null
  active: boolean
  default_at_signup: boolean
  permission_ids: number[]
  group_ids: Record<string, GroupAccess[]>
  user_count: number
}

export interface RoleGroup {
  id: number
  name: string
  active: boolean
}

export interface RolesOverview {
  roles: RoleRow[]
  permissions: RolePermission[]
  groups: RoleGroup[]
  my_role_ids: number[]
}

export const GROUP_ACCESS: { value: GroupAccess; label: string }[] = [
  { value: 'read', label: __('Read') },
  { value: 'create', label: __('Create') },
  { value: 'change', label: __('Change') },
  { value: 'overview', label: __('Overview') },
  { value: 'full', label: __('Full') },
]

export interface PermissionSection {
  key: string
  title: string
  permissions: RolePermission[]
}

const AGENT_PERMISSIONS = [
  'ticket.agent',
  'ticket.approver',
  'knowledge_base.editor',
  'knowledge_base.reader',
  'report',
  'chat.agent',
  'cti.agent',
]

// Admin area, agent work, customers, profile settings, anything else. Entries Zammad marks as
// not assignable on their own (e.g. "ticket") are left out.
export const permissionSections = (permissions: RolePermission[]): PermissionSection[] => {
  const assignable = permissions.filter((permission) => !permission.disabled)
  const isAdmin = (name: string) => name === 'admin' || name.startsWith('admin.')
  const isProfile = (name: string) => name === 'user_preferences' || name.startsWith('user_preferences.')
  const isCustomer = (name: string) => name === 'ticket.customer'
  const isAgent = (name: string) => AGENT_PERMISSIONS.includes(name)

  const sections: PermissionSection[] = [
    { key: 'admin', title: __('Administration'), permissions: assignable.filter((item) => isAdmin(item.name)) },
    {
      key: 'agent',
      title: __('Agent work'),
      permissions: AGENT_PERMISSIONS.map((name) => assignable.find((item) => item.name === name)).filter(
        (item): item is RolePermission => Boolean(item),
      ),
    },
    { key: 'customer', title: __('Customers'), permissions: assignable.filter((item) => isCustomer(item.name)) },
    { key: 'profile', title: __('Profile settings'), permissions: assignable.filter((item) => isProfile(item.name)) },
    {
      key: 'other',
      title: __('Other'),
      permissions: assignable.filter(
        (item) => !isAdmin(item.name) && !isProfile(item.name) && !isCustomer(item.name) && !isAgent(item.name),
      ),
    },
  ]

  return sections.filter((section) => section.permissions.length)
}

// "admin" includes every "admin.…", "user_preferences" every "user_preferences.…".
export const includedByParent = (permission: RolePermission, chosenNames: string[]) => {
  const parent = permission.name.split('.').slice(0, -1).join('.')
  return Boolean(parent) && chosenNames.includes(parent)
}

export const missingRequirements = (permission: RolePermission, chosenNames: string[]) =>
  permission.required.filter((name) => !chosenNames.includes(name))

// Full access stands for all the others; choosing it clears them.
export const toggleGroupAccess = (current: GroupAccess[] = [], access: GroupAccess): GroupAccess[] => {
  if (access === 'full') return current.includes('full') ? [] : ['full']

  const withoutFull = current.filter((item) => item !== 'full')
  return withoutFull.includes(access) ? withoutFull.filter((item) => item !== access) : [...withoutFull, access]
}

// Teams without any access are left out of what is saved.
export const cleanGroupAccess = (groupAccess: Record<string, GroupAccess[]>) =>
  Object.fromEntries(Object.entries(groupAccess).filter(([, access]) => access.length))

export const roleSummary = (role: RoleRow, permissions: RolePermission[]) => {
  const names = permissions.filter((permission) => role.permission_ids.includes(permission.id)).map((item) => item.name)
  const labels: string[] = []
  const adminAreas = names.filter((name) => name.startsWith('admin.')).length
  if (names.includes('admin')) labels.push(__('Admin'))
  else if (adminAreas) labels.push(i18n.t('Admin (%s areas)', adminAreas))
  if (names.includes('ticket.agent')) labels.push(__('Agent'))
  if (names.includes('ticket.approver')) labels.push(__('Approver'))
  if (names.includes('ticket.customer')) labels.push(__('Customer'))
  if (names.includes('knowledge_base.editor')) labels.push(__('KB editor'))
  else if (names.includes('knowledge_base.reader')) labels.push(__('KB reader'))
  return labels
}
