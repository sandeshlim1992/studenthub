// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { ref } from 'vue'

import type { StudenthubMember } from '#desktop/composables/useStudenthubMembers.ts'

// Student Hub: what the Members page lists. The navigation panel filters it (who, a role, a team)
// and the page orders it; both use this. The filters last while the app is open, the order is
// kept in this browser.

export type StudenthubMembersShow = 'everyone' | 'online' | 'out_of_office'
export type StudenthubMembersSort = 'role' | 'name' | 'last_active'

export const STUDENTHUB_MEMBERS_SHOW: { value: StudenthubMembersShow; label: string }[] = [
  { value: 'everyone', label: __('Everyone') },
  { value: 'online', label: __('Online now') },
  { value: 'out_of_office', label: __('Out of office') },
]

export const STUDENTHUB_MEMBERS_SORT: { value: StudenthubMembersSort; label: string }[] = [
  { value: 'role', label: __('Role') },
  { value: 'name', label: __('Name') },
  { value: 'last_active', label: __('Last active') },
]

// The role names of the members API, most rights first.
const ROLE_ORDER = [__('Admin & Manager'), __('Admin'), __('Agent & Manager'), __('Agent')]

const SORT_KEY = 'studenthub-members-sort'

const show = ref<StudenthubMembersShow>('everyone')
const role = ref('')
const team = ref('')
const sort = ref<StudenthubMembersSort>('role')
let isSortRestored = false

const restoreSort = () => {
  isSortRestored = true

  try {
    const kept = localStorage.getItem(SORT_KEY)
    if (STUDENTHUB_MEMBERS_SORT.some((option) => option.value === kept))
      sort.value = kept as StudenthubMembersSort
  } catch {
    // Not kept; the members are ordered by role.
  }
}

export const compareStudenthubMemberRoles = (a: string, b: string) => {
  const rank = (name: string) => {
    const index = ROLE_ORDER.indexOf(name)
    return index === -1 ? ROLE_ORDER.length : index
  }

  return rank(a) - rank(b) || a.localeCompare(b)
}

const byName = (a: StudenthubMember, b: StudenthubMember) => a.name.localeCompare(b.name)

// Online members by when they were last active, the others by their last login; latest first.
const lastSeen = (member: StudenthubMember) =>
  Date.parse((member.online ? member.last_active_at : member.last_login) ?? '') || 0

export interface StudenthubMembersGroup {
  role: string | null
  members: StudenthubMember[]
}

// Ordered by role: one group per role, names in alphabetical order. Otherwise one group.
export const arrangeStudenthubMembers = (
  members: StudenthubMember[],
  sortBy: StudenthubMembersSort,
): StudenthubMembersGroup[] => {
  if (!members.length) return []

  if (sortBy === 'name') return [{ role: null, members: [...members].sort(byName) }]
  if (sortBy === 'last_active')
    return [
      {
        role: null,
        members: [...members].sort((a, b) => lastSeen(b) - lastSeen(a) || byName(a, b)),
      },
    ]

  return [...new Set(members.map((member) => member.role))]
    .sort(compareStudenthubMemberRoles)
    .map((name) => ({
      role: name,
      members: members.filter((member) => member.role === name).sort(byName),
    }))
}

export const useStudenthubMembersFilter = () => {
  if (!isSortRestored) restoreSort()

  const setSort = (value: StudenthubMembersSort) => {
    sort.value = value

    try {
      localStorage.setItem(SORT_KEY, value)
    } catch {
      // Not kept; the members are ordered by role next time.
    }
  }

  const matches = (member: StudenthubMember) => {
    if (show.value === 'online' && !member.online) return false
    if (show.value === 'out_of_office' && !member.out_of_office) return false
    if (role.value && member.role !== role.value) return false

    return !team.value || member.teams.includes(team.value)
  }

  const clear = () => {
    show.value = 'everyone'
    role.value = ''
    team.value = ''
  }

  return { show, role, team, sort, setSort, matches, clear }
}
