// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { computed, unref, type Ref } from 'vue'
import { useRoute } from 'vue-router'

import type { BreadcrumbItem } from '#desktop/components/CommonBreadcrumb/types.ts'

import {
  useStudenthubTopBarCrumbsWhileShown,
  type StudenthubTopBarCrumb,
} from './useStudenthubTopBarCrumbs.ts'

// Student Hub: Administration (/manage) and Reporting show the page's breadcrumb trail in the top
// bar (e.g. "Administration / Channels / Email") instead of above the page, like the Tickets pages.
// Called by LayoutContent with the page's breadcrumb items; other pages keep theirs.

const TOP_BAR_PATHS = ['/manage', '/report']

// The admin pages link back with `to` (Zammad's items use `route`).
type PageBreadcrumbItem = BreadcrumbItem & { to?: string }

export const isStudenthubTopBarCrumbPath = (path: string) =>
  TOP_BAR_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))

export const toStudenthubTopBarCrumbs = (
  items: PageBreadcrumbItem[] | undefined,
): StudenthubTopBarCrumb[] =>
  (items ?? []).map((item) => {
    const route = item.route ?? item.to

    return {
      label: unref(item.label),
      route: typeof route === 'string' ? route : undefined,
    }
  })

export const useStudenthubLayoutCrumbs = (items: Ref<BreadcrumbItem[] | undefined>) => {
  // A page belongs to one route, so its place is decided once (pages are kept alive while the
  // route moves on).
  const path = useRoute()?.path ?? ''
  const isInTopBar = isStudenthubTopBarCrumbPath(path)

  if (isInTopBar) useStudenthubTopBarCrumbsWhileShown(() => toStudenthubTopBarCrumbs(items.value))

  return { isInTopBar: computed(() => isInTopBar && Boolean(items.value?.length)) }
}
