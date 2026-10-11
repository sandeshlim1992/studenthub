// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

import { useStudenthubMembers } from '../useStudenthubMembers.ts'

const Viewer = defineComponent({
  setup() {
    const { members } = useStudenthubMembers()
    return () => h('span', members.value.length)
  },
})

describe('useStudenthubMembers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('makes one request for the parts shown at the same time, and a new one for a part shown later', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ members: [{ id: 2, name: 'Nicole' }] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    // The top bar button and the dashboard's "who is online" appear together.
    const topBar = mount(Viewer)
    const panel = mount(Viewer)
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(panel.text()).toBe('1')

    const membersPage = mount(Viewer)
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(2)

    ;[topBar, panel, membersPage].forEach((wrapper) => wrapper.unmount())
  })
})
