// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { initializeStore } from '#tests/support/components/initializeStore.ts'
import { mockPermissions } from '#tests/support/mock-permissions.ts'

import { useSessionStore } from '#shared/stores/session.ts'

import studenthubStaffToDesktop from '../studenthubStaffToDesktop.ts'

import type { RouteLocationNormalized } from 'vue-router'

const { getIsMobile, setIsMobile } = vi.hoisted(() => {
  let isMobile = true

  return {
    getIsMobile: () => isMobile,
    setIsMobile: (value: boolean) => {
      isMobile = value
    },
  }
})

vi.mock('#shared/utils/browser.ts', () => ({
  get isMobile() {
    return getIsMobile()
  },
}))

const navigateTo = (path: string) =>
  studenthubStaffToDesktop(
    { path } as RouteLocationNormalized,
    {} as RouteLocationNormalized,
    vi.fn(),
  )

describe('studenthubStaffToDesktop', () => {
  const replace = vi.fn()

  beforeEach(() => {
    setIsMobile(true)
    replace.mockReset()
    initializeStore()
    useSessionStore().user = null

    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...window.location, replace },
    })
  })

  it('sends staff on a phone to the same ticket in the new UI', () => {
    mockPermissions(['ticket.agent'])

    expect(navigateTo('/tickets/42')).toBe(false)
    expect(replace).toHaveBeenCalledWith('/tickets/42')
  })

  it('leaves students in the mobile app', () => {
    mockPermissions(['ticket.customer'])

    expect(navigateTo('/tickets/42')).toBe(true)
    expect(replace).not.toHaveBeenCalled()
  })

  it('leaves staff on a computer, who opened /mobile directly, in the mobile app', () => {
    setIsMobile(false)
    mockPermissions(['ticket.agent'])

    expect(navigateTo('/')).toBe(true)
    expect(replace).not.toHaveBeenCalled()
  })

  it('waits until the signed-in person is known', () => {
    expect(navigateTo('/')).toBe(true)
    expect(replace).not.toHaveBeenCalled()
  })
})
