// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { i18n } from '#shared/i18n/index.ts'

// Student Hub: LDAP servers for the new UI, as the classic wizard sets them up. The settings are an
// LdapSource's preferences (saved with /api/v1/ldap_sources); the service account password comes
// back masked and is kept when the mask is sent back.

export const PASSWORD_MASK = '**********'

export type LdapSsl = 'ssl' | 'starttls' | 'off'

export interface LdapPreferences {
  host?: string
  ssl?: LdapSsl
  ssl_verify?: boolean
  base_dn?: string
  bind_user?: string
  bind_pw?: string
  user_uid?: string
  user_filter?: string
  group_uid?: string
  group_filter?: string
  user_attributes?: Record<string, string>
  group_role_map?: Record<string, string[]>
  group_role_recursive?: Record<string, boolean>
  unassigned_users?: 'sigup_roles' | 'skip_sync'
  [key: string]: unknown
}

export interface LdapSource {
  id: number
  name: string
  active: boolean
  prio?: number
  preferences: LdapPreferences
}

export interface LdapOptions {
  enabled: boolean
  roles: { id: number; name: string }[]
  user_attributes: { name: string; display: string }[]
}

export interface LdapJobResult {
  sum?: number
  total?: number
  created?: number
  updated?: number
  unchanged?: number
  skipped?: number
  failed?: number
  deactivated?: number
  error?: string
  info?: string
  role_ids?: Record<string, Record<string, number>>
}

export interface LdapJob {
  id: number
  started_at: string | null
  finished_at: string | null
  result: LdapJobResult | null
}

// Answers of /api/v1/integration/ldap/discover and /bind
export interface LdapDiscoverAnswer {
  result: 'ok' | 'failed'
  message?: string
  error?: string
  attributes?: { namingcontexts?: string[] }
}

export interface LdapBindAnswer {
  result: 'ok' | 'failed'
  message?: string
  user_filter?: string
  user_uid?: string
  user_attributes?: Record<string, string>
  group_filter?: string
  group_uid?: string
  groups?: Record<string, string>
}

export interface UserAttributeRow {
  uid: number
  source: string
  dest: string
}

export interface GroupRoleRow {
  uid: number
  source: string
  dest: string
  recursive: boolean
}

let nextUid = 1
const uid = () => nextUid++

// What the classic wizard suggests for Active Directory.
export const DEFAULT_USER_ATTRIBUTES: Record<string, string> = {
  givenname: 'firstname',
  sn: 'lastname',
  mail: 'email',
  samaccountname: 'login',
  telephonenumber: 'phone',
}

export const newUserAttributeRow = (source = '', dest = ''): UserAttributeRow => ({ uid: uid(), source, dest })
export const newGroupRoleRow = (source = '', dest = '', recursive = false): GroupRoleRow => ({
  uid: uid(),
  source,
  dest,
  recursive,
})

export const toUserAttributeRows = (map?: Record<string, string>) =>
  Object.entries(map && Object.keys(map).length ? map : DEFAULT_USER_ATTRIBUTES).map(([source, dest]) =>
    newUserAttributeRow(source, dest),
  )

export const fromUserAttributeRows = (rows: UserAttributeRow[]) =>
  Object.fromEntries(rows.filter((row) => row.source && row.dest).map((row) => [row.source, row.dest]))

export const toGroupRoleRows = (map?: Record<string, string[]>, recursive?: Record<string, boolean>) =>
  Object.entries(map ?? {}).flatMap(([source, roles]) =>
    roles.map((role) => newGroupRoleRow(source, String(role), Boolean(recursive?.[source]))),
  )

export const fromGroupRoleRows = (rows: GroupRoleRow[]) => {
  const groupRoleMap: Record<string, string[]> = {}
  const groupRoleRecursive: Record<string, boolean> = {}
  rows
    .filter((row) => row.source && row.dest)
    .forEach((row) => {
      groupRoleMap[row.source] = [...(groupRoleMap[row.source] ?? []), row.dest]
      groupRoleRecursive[row.source] = row.recursive
    })
  return { group_role_map: groupRoleMap, group_role_recursive: groupRoleRecursive }
}

export const mappingProblems = (rows: UserAttributeRow[]) =>
  rows.some((row) => row.source && row.dest === 'login')
    ? []
    : [i18n.t("Attribute '%s' is required in the mapping", 'login')]

// The shortest naming context is usually the domain's base DN.
export const suggestedBaseDn = (namingContexts: string[] = []) =>
  namingContexts.reduce((best, dn) => (!best || dn.length < best.length ? dn : best), '')

// "ldaps://dc.example.ac.uk:636" → host "dc.example.ac.uk:636" and SSL, as in the classic wizard: Zammad
// wants the host (with an optional port) and takes the encryption from its own setting.
export const splitLdapHost = (value: string): { host: string; ssl?: LdapSsl } => {
  const match = value.trim().match(/^(ldaps?):\/\/(.+)$/i)
  if (!match) return { host: value.trim() }

  return { host: match[2], ssl: match[1].toLowerCase() === 'ldaps' ? 'ssl' : 'off' }
}

export const sslLabel = (ssl?: LdapSsl) => {
  if (ssl === 'off') return __('No SSL')
  if (ssl === 'starttls') return __('STARTTLS')
  return __('SSL')
}
