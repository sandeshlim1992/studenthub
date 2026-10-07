// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { computed } from 'vue'

import { useSessionStore } from '#shared/stores/session.ts'

import { useStudenthubApprovalViewer } from './useStudenthubApprovalViewer.ts'

// Student Hub: the signed-in user's role under the logo in the navigation panel: Admin, Agent or
// Manager, with "& Manager" for admins and agents who also approve. Admins aren't called agents
// (the Teams sync gives the Admin role agent access). Empty until a manager's roles are known.
export const useStudenthubRoleLabel = () => {
  const session = useSessionStore()
  const { isLoaded, isManagerOnly } = useStudenthubApprovalViewer()

  return computed(() => {
    if (!isLoaded.value) return ''

    const isManager = session.hasPermission('ticket.approver')
    if (isManagerOnly.value) return __('Manager')

    if (session.hasPermission('admin')) return isManager ? __('Admin & Manager') : __('Admin')
    if (session.hasPermission('ticket.agent')) return isManager ? __('Agent & Manager') : __('Agent')

    return isManager ? __('Manager') : ''
  })
}
