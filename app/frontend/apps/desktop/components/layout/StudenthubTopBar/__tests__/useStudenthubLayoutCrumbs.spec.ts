// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { defineComponent, h, ref } from 'vue'

import { renderComponent } from '#tests/support/components/index.ts'

import type { BreadcrumbItem } from '#desktop/components/CommonBreadcrumb/types.ts'

import {
  isStudenthubTopBarCrumbPath,
  toStudenthubTopBarCrumbs,
  useStudenthubLayoutCrumbs,
} from '../useStudenthubLayoutCrumbs.ts'
import {
  setStudenthubTopBarCrumbs,
  useStudenthubTopBarCrumbs,
} from '../useStudenthubTopBarCrumbs.ts'

let currentPath = '/'

vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRoute: () => ({ path: currentPath }),
}))

const emailPageItems = [
  { label: 'Administration', to: '/manage' },
  { label: 'Channels' },
  { label: 'Email' },
] as BreadcrumbItem[]

const renderPage = (path: string, items: BreadcrumbItem[]) => {
  currentPath = path
  let isInTopBar = false

  const Page = defineComponent({
    setup() {
      isInTopBar = useStudenthubLayoutCrumbs(ref(items)).isInTopBar.value

      return () => h('div')
    },
  })

  renderComponent(Page)

  return { isInTopBar }
}

describe('useStudenthubLayoutCrumbs', () => {
  afterEach(() => setStudenthubTopBarCrumbs([]))

  it('applies to Administration and Reporting only', () => {
    expect(isStudenthubTopBarCrumbPath('/manage')).toBe(true)
    expect(isStudenthubTopBarCrumbPath('/manage/channels/email')).toBe(true)
    expect(isStudenthubTopBarCrumbPath('/report')).toBe(true)
    expect(isStudenthubTopBarCrumbPath('/tickets/view')).toBe(false)
    expect(isStudenthubTopBarCrumbPath('/managers')).toBe(false)
  })

  it('links the crumbs given with `to` or `route`', () => {
    expect(
      toStudenthubTopBarCrumbs([
        { label: 'Administration', route: '/manage' },
        { label: 'System', to: '/manage/system' } as BreadcrumbItem,
        { label: 'API' },
      ]),
    ).toEqual([
      { label: 'Administration', route: '/manage' },
      { label: 'System', route: '/manage/system' },
      { label: 'API', route: undefined },
    ])
  })

  it("shows an admin page's trail in the top bar instead of above the page", () => {
    const { isInTopBar } = renderPage('/manage/channels/email', emailPageItems)

    expect(isInTopBar).toBe(true)
    expect(useStudenthubTopBarCrumbs().value).toEqual([
      { label: 'Administration', route: '/manage' },
      { label: 'Channels', route: undefined },
      { label: 'Email', route: undefined },
    ])
  })

  it("leaves other pages' crumbs alone", () => {
    setStudenthubTopBarCrumbs([{ label: 'Tickets', route: '/tickets/view' }, { label: 'Service Desk' }])

    const { isInTopBar } = renderPage('/tickets/view/1', [{ label: 'Service Desk' }])

    expect(isInTopBar).toBe(false)
    expect(useStudenthubTopBarCrumbs().value).toEqual([
      { label: 'Tickets', route: '/tickets/view' },
      { label: 'Service Desk' },
    ])
  })
})
