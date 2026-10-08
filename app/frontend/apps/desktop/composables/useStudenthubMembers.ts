// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { useSessionStore } from '#shared/stores/session.ts'

import { useStudenthubApprovalViewer } from './useStudenthubApprovalViewer.ts'

// Student Hub "Members": the agents and admins, who of them is online and when each last signed
// in (GET /api/v1/studenthub/members). One list for the top bar button and the Members page,
// refreshed every minute while either is shown. The refresh also keeps the viewer's own session
// active, so staff with the new UI open count as online.

export interface StudenthubMember {
  id: number
  firstname: string | null
  lastname: string | null
  name: string
  image: string | null
  role: string
  teams: string[]
  online: boolean
  last_active_at: string | null
  last_login: string | null
  out_of_office: boolean
}

export const MEMBERS_REFRESH_INTERVAL = 60_000

const members = ref<StudenthubMember[]>([])
const isLoaded = ref(false)
const hasError = ref(false)

let viewers = 0
let timer: ReturnType<typeof setInterval> | undefined

const load = () =>
  // fetch can throw at once (tests), so start it inside the promise chain.
  Promise.resolve()
    .then(() =>
      fetch('/api/v1/studenthub/members', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      }),
    )
    .then((response) => (response.ok ? response.json() : Promise.reject(response)))
    .then((data: { members: StudenthubMember[] }) => {
      members.value = data.members
      hasError.value = false
    })
    .catch(() => {
      hasError.value = true
    })
    .finally(() => {
      isLoaded.value = true
    })

// Agents and admins; not managers without another staff role (they aren't members).
export const useStudenthubMembersAccess = () => {
  const session = useSessionStore()
  const { isLoaded: isViewerLoaded, isManagerOnly } = useStudenthubApprovalViewer()

  return computed(
    () =>
      session.hasPermission(['ticket.agent', 'admin']) &&
      isViewerLoaded.value &&
      !isManagerOnly.value,
  )
}

export const useStudenthubMembers = () => {
  onMounted(() => {
    viewers += 1
    void load()
    if (viewers === 1) timer = setInterval(load, MEMBERS_REFRESH_INTERVAL)
  })

  onBeforeUnmount(() => {
    viewers -= 1
    if (viewers > 0 || !timer) return

    clearInterval(timer)
    timer = undefined
  })

  const onlineMembers = computed(() => members.value.filter((member) => member.online))
  const offlineMembers = computed(() => members.value.filter((member) => !member.online))

  return { members, onlineMembers, offlineMembers, isLoaded, hasError, refresh: load }
}

// For CommonUserAvatar.
export const studenthubMemberAvatar = (member: StudenthubMember) => ({
  id: `gid://zammad/User/${member.id}`,
  firstname: member.firstname,
  lastname: member.lastname,
  fullname: member.name,
  image: member.image,
  outOfOffice: member.out_of_office,
  active: true,
})
