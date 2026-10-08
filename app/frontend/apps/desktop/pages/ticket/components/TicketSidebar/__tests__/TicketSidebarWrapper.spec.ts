// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { computed, defineComponent, h, provide, ref } from 'vue'

import { renderComponent } from '#tests/support/components/index.ts'

import { STUDENTHUB_SIDE_PANEL_KEY, type StudenthubSidePanelMode } from '../studenthubSidePanel.ts'
import TicketSidebarWrapper from '../TicketSidebarWrapper.vue'

import type { TicketSidebarPlugin } from '../plugins/types.ts'

const plugin = (title: string, icon: string) => ({ title, icon }) as TicketSidebarPlugin

const visiblePanel = ref('information')

// The rail's part: it provides the mode, and mounts Ticket always and the open panel.
const renderPanels = (mode: StudenthubSidePanelMode) =>
  renderComponent(
    defineComponent({
      setup() {
        provide(STUDENTHUB_SIDE_PANEL_KEY, {
          leftPanel: 'information',
          mode,
          visiblePanel: computed(() => visiblePanel.value),
        })

        return () =>
          h('div', [
            h('div', { id: 'ticketSidebar' }),
            h('div', { id: 'studenthubSidePanel' }),
            h(
              TicketSidebarWrapper,
              {
                sidebar: 'information',
                sidebarPlugin: plugin('Ticket', 'chat-left-text'),
                selected: true,
              },
              () => h('p', 'Ticket panel'),
            ),
            h(
              TicketSidebarWrapper,
              {
                sidebar: 'customer',
                sidebarPlugin: plugin('Customer', 'person'),
                selected: visiblePanel.value === 'customer',
              },
              () => h('p', 'Customer panel'),
            ),
          ])
      },
    }),
  )

const panelArea = (id: string) => document.getElementById(id)!

describe('TicketSidebarWrapper (Student Hub panel placement)', () => {
  beforeEach(() => {
    visiblePanel.value = 'information'
  })

  it('shows one panel at a time in the column and keeps Ticket mounted', async () => {
    const view = renderPanels('column')

    expect(await view.findByText('Ticket panel')).toBeVisible()
    expect(panelArea('ticketSidebar')).toContainElement(view.getByText('Ticket panel'))
    expect(view.getByRole('button', { name: 'Ticket' })).toHaveClass('text-black!')

    visiblePanel.value = 'customer'

    expect(await view.findByText('Customer panel')).toBeVisible()
    expect(panelArea('ticketSidebar')).toContainElement(view.getByText('Customer panel'))
    expect(view.getByText('Ticket panel')).not.toBeVisible()
    expect(view.getByRole('button', { name: 'Ticket' })).not.toHaveClass('text-black!')
    expect(view.getByRole('button', { name: 'Customer' })).toHaveClass('text-black!')
  })

  it('opens other panels beside Ticket when split', async () => {
    visiblePanel.value = 'customer'

    const view = renderPanels('split')

    expect(await view.findByText('Customer panel')).toBeVisible()
    expect(panelArea('studenthubSidePanel')).toContainElement(view.getByText('Customer panel'))
    expect(panelArea('ticketSidebar')).toContainElement(view.getByText('Ticket panel'))
    expect(view.getByText('Ticket panel')).toBeVisible()
  })
})
