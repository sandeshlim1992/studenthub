// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { effectScope, ref, watch } from 'vue'

import { useAuthenticationStore } from '#shared/stores/authentication.ts'
import { useSessionStore } from '#shared/stores/session.ts'

// Student Hub: Recent in the navigation panel starts collapsed after each sign-in. Opening or closing
// it lasts until signing out, across pages and reloads of this browser tab (session storage, kept
// with the user's ID so another user in the same tab starts collapsed too).

const STORAGE_KEY = 'studenthub-recent-collapsed'

const isCollapsed = ref(true)
let isSetUp = false

interface Kept {
  userId: string
  collapsed: boolean
}

const readKept = (): Kept | null => {
  try {
    const kept = sessionStorage.getItem(STORAGE_KEY)
    return kept ? (JSON.parse(kept) as Kept) : null
  } catch {
    return null
  }
}

const forget = () => {
  isCollapsed.value = true

  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing kept.
  }
}

export const useStudenthubRecentCollapsed = () => {
  if (!isSetUp) {
    isSetUp = true

    const kept = readKept()
    isCollapsed.value = kept?.userId === useSessionStore().userId ? kept.collapsed : true

    // Detached, so it outlives the panel that first asked.
    effectScope(true).run(() => {
      watch(isCollapsed, (collapsed) => {
        try {
          sessionStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ userId: useSessionStore().userId, collapsed }),
          )
        } catch {
          // Not kept; Recent starts collapsed after a reload.
        }
      })
    })
  }

  // The store is new after signing out; a Set keeps the same callback once.
  useAuthenticationStore().registerLogoutCleanup(forget)

  return isCollapsed
}

// For tests.
export const resetStudenthubRecentCollapsed = () => {
  forget()
  isSetUp = false
}
