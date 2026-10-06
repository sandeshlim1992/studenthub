// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { reactive, ref } from 'vue'

import { renderComponent } from '#tests/support/components/index.ts'
import { mockApplicationConfig } from '#tests/support/mock-applicationConfig.ts'

import { useStudenthubTopBarCrumbs } from '#desktop/components/layout/StudenthubTopBar/useStudenthubTopBarCrumbs.ts'
import { provideTicketInformationMocks } from '#desktop/entities/ticket/__tests__/mocks/provideTicketInformationMocks.ts'
import { testOptionsTopBar } from '#desktop/pages/ticket/components/TicketDetailView/TicketDetailTopBar/__tests__/support/testOptions.ts'
import TopBarHeaderFull from '#desktop/pages/ticket/components/TicketDetailView/TicketDetailTopBar/components/TopBarHeaderFull.vue'

// The overviews store needs the server; the header only reads which Teams views the agent has.
const overviewsByLink = ref<Record<string, unknown>>({})

vi.mock('#desktop/entities/ticket/stores/ticketOverviews.ts', () => ({
  useTicketOverviewsStore: () => reactive({ overviewsByLink }),
}))

const copyToClipboardMock = vi.fn()

vi.mock('#shared/composables/useCopyToClipboard.ts', async () => ({
  useCopyToClipboard: () => ({ copyToClipboard: copyToClipboardMock }),
}))

const renderTopBarHeaderFull = ({
  ticket = testOptionsTopBar,
}: {
  ticket?: typeof testOptionsTopBar
} = {}) => {
  return renderComponent(
    {
      components: { TopBarHeaderFull },
      setup() {
        provideTicketInformationMocks(ticket)
      },
      template: '<TopBarHeaderFull />',
    },
    { form: true, router: true },
  )
}

describe('TopBarHeaderFull', () => {
  beforeEach(() => {
    copyToClipboardMock.mockReset()

    mockApplicationConfig({
      fqdn: 'zammad.example.com',
      http_type: 'http',
      ticket_hook: 'Ticket#',
    })
  })

  // Student Hub: the header shows the number, "Tickets / Users / Ticket#…" moves to the top bar.
  it('shows the ticket number with a copy button and fills the top bar crumbs', () => {
    overviewsByLink.value = {}
    const view = renderTopBarHeaderFull()

    expect(view.getByText('#89001')).toBeInTheDocument()
    expect(view.getByRole('button', { name: 'Copy ticket number' })).toBeInTheDocument()
    expect(useStudenthubTopBarCrumbs().value).toEqual([
      { label: 'Tickets', route: '/tickets/view' },
      { label: 'Users', route: undefined },
      { label: 'Ticket#89001' },
    ])
  })

  it("links the ticket's group to its Teams view when the agent has it", () => {
    overviewsByLink.value = { studenthub_team_1: { id: 'gid://zammad/Overview/1' } }
    renderTopBarHeaderFull()

    expect(useStudenthubTopBarCrumbs().value[1]).toEqual({
      label: 'Users',
      route: '/tickets/view/studenthub_team_1',
    })
  })

  it('shows the state and priority next to the title', () => {
    const view = renderTopBarHeaderFull()

    expect(view.getByText(testOptionsTopBar.state.name)).toBeInTheDocument()
    expect(view.getByText(testOptionsTopBar.priority.name)).toBeInTheDocument()
  })

  it('shows highlight actions for editable agent tickets', () => {
    const view = renderTopBarHeaderFull()

    expect(view.getByRole('button', { name: 'Highlight options' })).toBeInTheDocument()
  })

  it('hides highlight actions for readonly tickets', () => {
    const view = renderTopBarHeaderFull({
      ticket: {
        ...testOptionsTopBar,
        policy: { ...testOptionsTopBar.policy, update: false },
      },
    })

    expect(view.queryByRole('button', { name: 'Highlight options' })).not.toBeInTheDocument()
  })

  it('copies ticket number with desktop link', async () => {
    const view = renderTopBarHeaderFull()

    await view.events.click(view.getByIconName('files'))

    expect(copyToClipboardMock).toHaveBeenCalledWith([
      {
        data: {
          'text/html': '<a href="http://zammad.example.com/desktop/tickets/1">Ticket#89001</a>',
          'text/plain': 'Ticket#89001',
        },
        options: {
          presentationStyle: 'unspecified',
        },
      },
    ])
  })

  it('renders flex-col on narrow container', () => {
    const view = renderTopBarHeaderFull()
    const avatar = view.getAllByTestId('common-avatar')[0]
    let container = avatar.parentElement

    while (container && !container.classList.contains('flex-col')) {
      container = container.parentElement
    }

    expect(container).not.toBeNull()
    expect(container).toHaveClass('flex-col')
  })

  it('renders @5xl:flex-row on wide container', () => {
    const view = renderTopBarHeaderFull()
    const avatar = view.getAllByTestId('common-avatar')[0]
    let container = avatar.parentElement

    while (container && !container.classList.contains('flex-col')) {
      container = container.parentElement
    }

    expect(container).not.toBeNull()
    expect(container).toHaveClass('@5xl:flex-row')
  })
})
