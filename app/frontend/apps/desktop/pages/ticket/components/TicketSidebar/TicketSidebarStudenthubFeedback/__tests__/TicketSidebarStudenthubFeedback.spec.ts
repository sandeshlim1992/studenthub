// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { computed } from 'vue'

import { renderComponent } from '#tests/support/components/index.ts'
import { mockRouterHooks } from '#tests/support/mock-vue-router.ts'

import { TicketSidebarScreenType } from '#desktop/pages/ticket/types/sidebar.ts'

import feedbackSidebarPlugin from '../../plugins/studenthub-feedback.ts'
import TicketSidebarStudenthubFeedback from '../TicketSidebarStudenthubFeedback.vue'

mockRouterHooks()

vi.mock('#desktop/pages/ticket/composables/useTicketInformation.ts', () => ({
  useTicketInformation: () => ({ ticket: computed(() => ({ internalId: 886850 })) }),
}))

vi.mock('#desktop/pages/ticket/composables/usePersistentStates.ts', () => ({
  usePersistentStates: () => ({ persistentStates: { value: { scrollPosition: 0 } } }),
}))

const context = (stateType: string) => ({
  screenType: TicketSidebarScreenType.TicketDetailView,
  formValues: {},
  view: 'agent' as const,
  ticket: computed(() => ({ state: { stateType: { name: stateType } } })),
})

const renderFeedback = () =>
  renderComponent(TicketSidebarStudenthubFeedback, {
    props: {
      sidebar: 'studenthub-feedback',
      sidebarPlugin: feedbackSidebarPlugin,
      selected: true,
      context: context('closed'),
    },
    router: true,
    store: true,
    global: { stubs: { TicketSidebarWrapper: { template: '<div><slot /></div>' } } },
  })

describe('Customer feedback in the ticket sidebar', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('is offered on closed tickets only', () => {
    expect(feedbackSidebarPlugin.available?.(context('closed') as never)).toBe(true)
    expect(feedbackSidebarPlugin.available?.(context('open') as never)).toBe(false)
  })

  it("shows the customer's rating and comment", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            items: [
              {
                id: 1,
                rating: 4,
                comments: 'Quick and friendly.',
                rated_at: '2026-10-05T10:00:00Z',
                customer_name: 'Test Student',
                owner_name: 'Test Agent',
              },
            ],
          }),
        ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const view = renderFeedback()

    expect(await view.findByLabelText('4 out of 5 stars')).toHaveTextContent('4/5')
    expect(view.getByText('Quick and friendly.')).toBeInTheDocument()
    expect(view.getByText('Test Student')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/feedback_collection/tickets/886850', expect.anything())
  })

  it('says when there is no feedback yet, or it could not be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ items: [] }))))
    const view = renderFeedback()
    expect(await view.findByText('No feedback for this ticket yet.')).toBeInTheDocument()
    view.unmount()

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Not authorized' }), { status: 403 })))
    const failed = renderFeedback()
    expect(await failed.findByText('Feedback could not be loaded.')).toBeInTheDocument()
  })
})
