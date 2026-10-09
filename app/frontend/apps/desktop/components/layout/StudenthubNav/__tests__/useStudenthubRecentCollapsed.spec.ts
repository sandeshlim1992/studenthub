// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { nextTick } from 'vue'

import { mockUserCurrent } from '#tests/support/mock-userCurrent.ts'

import { useAuthenticationStore } from '#shared/stores/authentication.ts'

import {
  resetStudenthubRecentCollapsed,
  useStudenthubRecentCollapsed,
} from '../useStudenthubRecentCollapsed.ts'

// A reload: the module starts again, session storage stays.
const reload = () => {
  const kept = sessionStorage.getItem('studenthub-recent-collapsed')
  resetStudenthubRecentCollapsed()
  if (kept) sessionStorage.setItem('studenthub-recent-collapsed', kept)
}

describe('useStudenthubRecentCollapsed', () => {
  beforeEach(() => {
    mockUserCurrent({ id: 'gid://zammad/User/2' })
    resetStudenthubRecentCollapsed()
  })

  afterEach(() => {
    sessionStorage.clear()
  })

  it('starts collapsed and keeps it opened across pages and reloads', async () => {
    const collapsed = useStudenthubRecentCollapsed()
    expect(collapsed.value).toBe(true)

    collapsed.value = false
    await nextTick()

    expect(useStudenthubRecentCollapsed().value).toBe(false)

    reload()
    expect(useStudenthubRecentCollapsed().value).toBe(false)
  })

  it('starts collapsed for another user in the same tab', async () => {
    useStudenthubRecentCollapsed().value = false
    await nextTick()

    reload()
    mockUserCurrent({ id: 'gid://zammad/User/3' })

    expect(useStudenthubRecentCollapsed().value).toBe(true)
  })

  it('collapses again on signing out', async () => {
    const authentication = useAuthenticationStore()
    const register = vi.spyOn(authentication, 'registerLogoutCleanup')

    const collapsed = useStudenthubRecentCollapsed()
    collapsed.value = false
    await nextTick()

    register.mock.calls[0][0]()
    await nextTick()

    expect(collapsed.value).toBe(true)

    reload()
    expect(useStudenthubRecentCollapsed().value).toBe(true)
  })
})
