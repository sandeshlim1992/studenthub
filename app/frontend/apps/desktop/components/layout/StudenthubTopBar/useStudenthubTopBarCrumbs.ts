// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import {
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  readonly,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from 'vue'

// Student Hub: "Tickets / My ALL Tickets" next to the search in the top bar. A page sets its
// crumbs while it is shown and clears them when it is left (pages are kept alive). A page only
// clears crumbs it set itself: the next page sets its crumbs before the old one is hidden.

export interface StudenthubTopBarCrumb {
  label: string
  route?: string
}

const crumbs = ref<StudenthubTopBarCrumb[]>([])
let crumbsOwner: symbol | undefined

export const setStudenthubTopBarCrumbs = (items: StudenthubTopBarCrumb[], owner?: symbol) => {
  crumbs.value = items
  crumbsOwner = owner
}

export const clearStudenthubTopBarCrumbs = (owner: symbol) => {
  if (crumbsOwner !== owner) return

  setStudenthubTopBarCrumbs([])
}

export const useStudenthubTopBarCrumbs = () => readonly(crumbs)

// For a page component: shows its crumbs while the page is on screen (kept-alive pages are
// only hidden when the user moves on).
export const useStudenthubTopBarCrumbsWhileShown = (
  items: MaybeRefOrGetter<StudenthubTopBarCrumb[]>,
) => {
  const owner = Symbol('studenthub-top-bar-crumbs')
  let isShown = true

  const update = () => {
    if (isShown) setStudenthubTopBarCrumbs(toValue(items), owner)
  }

  watch(() => toValue(items), update, { immediate: true, deep: true })

  onActivated(() => {
    isShown = true
    update()
  })

  onDeactivated(() => {
    isShown = false
    clearStudenthubTopBarCrumbs(owner)
  })

  onBeforeUnmount(() => clearStudenthubTopBarCrumbs(owner))
}
