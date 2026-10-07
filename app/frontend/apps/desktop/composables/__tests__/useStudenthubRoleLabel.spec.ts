// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { computed, ref } from 'vue'

import { mockPermissions } from '#tests/support/mock-permissions.ts'

import { useStudenthubRoleLabel } from '../useStudenthubRoleLabel.ts'

const isLoaded = ref(true)
const isManagerOnly = ref(false)

vi.mock('#desktop/composables/useStudenthubApprovalViewer.ts', () => ({
  useStudenthubApprovalViewer: () => ({
    isLoaded: computed(() => isLoaded.value),
    isManagerOnly: computed(() => isManagerOnly.value),
  }),
}))

describe('useStudenthubRoleLabel', () => {
  beforeEach(() => {
    isLoaded.value = true
    isManagerOnly.value = false
  })

  it.each([
    [['admin', 'ticket.agent'], 'Admin'],
    [['admin', 'ticket.agent', 'ticket.approver'], 'Admin & Manager'],
    [['ticket.agent'], 'Agent'],
    [['ticket.agent', 'ticket.approver'], 'Agent & Manager'],
    [['ticket.agent', 'admin.user'], 'Agent'],
  ])('names %j as %s', (permissions, label) => {
    mockPermissions(permissions)

    expect(useStudenthubRoleLabel().value).toBe(label)
  })

  it('names managers without another staff role Manager (their role carries ticket.agent)', () => {
    mockPermissions(['ticket.agent', 'ticket.approver'])
    isManagerOnly.value = true

    expect(useStudenthubRoleLabel().value).toBe('Manager')
  })

  it("shows nothing until a manager's roles are known", () => {
    mockPermissions(['ticket.agent', 'ticket.approver'])
    isLoaded.value = false

    const label = useStudenthubRoleLabel()
    expect(label.value).toBe('')

    isManagerOnly.value = true
    isLoaded.value = true
    expect(label.value).toBe('Manager')
  })
})
