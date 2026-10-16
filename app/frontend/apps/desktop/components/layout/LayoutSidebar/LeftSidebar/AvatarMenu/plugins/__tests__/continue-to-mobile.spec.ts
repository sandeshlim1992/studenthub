// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { initializeStore } from '#tests/support/components/initializeStore.ts'
import { mockPermissions } from '#tests/support/mock-permissions.ts'
import { waitFor } from '#tests/support/vitest-wrapper.ts'

import { useSessionStore } from '#shared/stores/session.ts'

import { MOBILE_SLUG } from '#desktop/composables/responsiveness/useMobileNavigation.ts'

import continueToMobileItem from '../continue-to-mobile.ts'

const { getIsMobile, setIsMobile } = vi.hoisted(() => {
  let isMobile = false

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

describe('avatar menu continue-to-mobile plugin', () => {
  beforeEach(() => {
    setIsMobile(false)
    localStorage.removeItem('forceDesktopApp')

    // Student Hub: the entry asks whether the signed-in person is staff.
    initializeStore()
    useSessionStore().user = null

    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: {
        ...window.location,
        pathname: '/desktop',
        href: '/desktop',
      },
    })
  })

  it('is hidden by default on non-mobile devices', () => {
    setIsMobile(false)

    expect(continueToMobileItem.show?.()).toBe(false)
  })

  it('is shown on mobile devices', () => {
    setIsMobile(true)

    expect(continueToMobileItem.show?.()).toBe(true)
  })

  // Student Hub: the mobile app is for students and sends staff back to the new UI.
  it('is hidden for staff on a phone', () => {
    setIsMobile(true)
    mockPermissions(['ticket.agent'])

    expect(continueToMobileItem.show?.()).toBe(false)
  })

  it('is shown when desktop mode was forced before', () => {
    setIsMobile(false)
    localStorage.setItem('forceDesktopApp', 'true')

    expect(continueToMobileItem.show?.()).toBeTruthy()
  })

  it('clears forced desktop mode and navigates to mobile when clicked', async () => {
    setIsMobile(false)

    localStorage.setItem('forceDesktopApp', 'true')

    continueToMobileItem.onClick?.()

    await waitFor(() => {
      expect(localStorage.getItem('forceDesktopApp')).toBeNull()
    })

    await waitFor(() => {
      expect(window.location.href).toBe(MOBILE_SLUG)
    })
  })
})
