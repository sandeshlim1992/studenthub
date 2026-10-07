// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { within } from '@testing-library/vue'

import { renderComponent } from '#tests/support/components/index.ts'

import { useNotifications } from '#shared/components/CommonNotifications/index.ts'
import { setCSRFToken } from '#shared/server/apollo/utils/csrfToken.ts'

import Tags from '../views/Tags.vue'
import TicketPriorities from '../views/TicketPriorities.vue'
import TicketStates from '../views/TicketStates.vue'

const mockConfirmation = vi.hoisted(() => ({ variant: vi.fn(), plain: vi.fn() }))

vi.mock('#shared/composables/useConfirmation.ts', () => ({
  useConfirmation: () => ({
    waitForVariantConfirmation: mockConfirmation.variant,
    waitForConfirmation: mockConfirmation.plain,
  }),
}))

const mockServer = (routes: Record<string, () => { status?: number; body: unknown }>) => {
  const calls: { method: string; url: string; body?: unknown }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET'
      calls.push({ method, url, body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined })
      const handler = routes[`${method} ${url}`]
      const reply = handler ? handler() : { status: 404, body: { error: `No mock for ${method} ${url}` } }
      return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200 })
    }),
  )
  return calls
}

const render = (component: typeof Tags) =>
  renderComponent(component, {
    router: true,
    store: true,
    global: { stubs: { LayoutContent: { template: '<div><slot /></div>' } } },
  })

const stateTypes = [
  { id: 1, name: 'new' },
  { id: 2, name: 'open' },
  { id: 3, name: 'pending reminder' },
  { id: 4, name: 'pending action' },
  { id: 5, name: 'closed' },
  { id: 6, name: 'merged' },
]

const state = (id: number, name: string, typeId: number, extra = {}) => ({
  id,
  name,
  state_type_id: typeId,
  state_type: stateTypes.find((type) => type.id === typeId)!.name,
  next_state_id: null,
  ignore_escalation: false,
  default_create: false,
  default_follow_up: false,
  active: true,
  note: null,
  ticket_count: 0,
  ...extra,
})

const states = {
  states: [
    state(1, 'new', 1, { default_create: true, ticket_count: 40 }),
    state(2, 'open', 2, { default_follow_up: true, ticket_count: 120 }),
    state(4, 'closed', 5, { ticket_count: 5000 }),
    state(5, 'merged', 6),
    state(9, 'Awaiting parts', 2),
  ],
  state_types: stateTypes,
}

describe('Ticket states, priorities and tags', () => {
  beforeEach(() => {
    setCSRFToken('token-1')
    useNotifications().clearAllNotifications()
    mockConfirmation.variant.mockResolvedValue(true)
    mockConfirmation.plain.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('ticket states', () => {
    it('lists the states; only unused ones can be deleted, built-in ones not changed', async () => {
      mockServer({ 'GET /api/v1/studenthub/ticket_states': () => ({ body: states }) })

      const view = render(TicketStates)

      const open = (await view.findByText('open')).closest('tr')!
      expect(open).toHaveTextContent('Customer replies')
      expect(open).toHaveTextContent('120')
      expect(within(open).queryByRole('button', { name: 'Delete open' })).not.toBeInTheDocument()
      expect(view.getByText('merged').closest('tr')).toHaveTextContent('Built in')
      expect(view.getByRole('button', { name: 'Delete Awaiting parts' })).toBeInTheDocument()
    })

    it('adds a pending action state that changes to another state', async () => {
      const calls = mockServer({
        'GET /api/v1/studenthub/ticket_states': () => ({ body: states }),
        'POST /api/v1/ticket_states': () => ({ status: 201, body: { id: 10 } }),
      })

      const view = render(TicketStates)
      await view.findByText('open')
      await view.events.click(view.getByRole('button', { name: 'New state' }))

      const form = view.getByRole('form', { name: 'New state' })
      await view.events.type(within(form).getByLabelText('Name'), 'Waiting for parts')
      await view.events.selectOptions(within(form).getByLabelText('Type'), '4')
      await view.events.click(within(form).getByRole('button', { name: 'Save state' }))
      expect(within(form).getByRole('alert')).toHaveTextContent('Choose the state it changes to.')

      await view.events.selectOptions(within(form).getByLabelText('Changes to, when the pending time is reached'), '2')
      await view.events.click(within(form).getByLabelText('Pause SLA escalation in this state'))
      await view.events.click(within(form).getByRole('button', { name: 'Save state' }))

      await vi.waitFor(() => expect(calls.some((call) => call.method === 'POST')).toBe(true))
      expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
        name: 'Waiting for parts',
        state_type_id: 4,
        next_state_id: 2,
        ignore_escalation: true,
        default_create: false,
        default_follow_up: false,
        active: true,
        note: null,
      })
    })
  })

  describe('ticket priorities', () => {
    it('edits a priority', async () => {
      const calls = mockServer({
        'GET /api/v1/studenthub/ticket_priorities': () => ({
          body: {
            priorities: [
              { id: 4, name: 'P1 - Critical', ui_color: 'high-priority', ui_icon: null, default_create: false, active: true, note: null, ticket_count: 12 },
              { id: 2, name: 'P3 - Normal', ui_color: null, ui_icon: null, default_create: true, active: true, note: null, ticket_count: 800 },
            ],
          },
        }),
        'PUT /api/v1/ticket_priorities/4': () => ({ body: {} }),
      })

      const view = render(TicketPriorities)

      const critical = (await view.findByText('P1 - Critical')).closest('tr')!
      expect(critical).toHaveTextContent('High (highlighted)')
      expect(view.getByText('P3 - Normal').closest('tr')).toHaveTextContent('New tickets')

      await view.events.click(within(critical).getByRole('button', { name: 'Edit P1 - Critical' }))
      const form = view.getByRole('form', { name: 'Edit priority' })
      await view.events.selectOptions(within(form).getByLabelText('Highlight'), 'None')
      await view.events.click(within(form).getByRole('button', { name: 'Save priority' }))

      await vi.waitFor(() =>
        expect(calls.find((call) => call.method === 'PUT')?.body).toEqual({
          name: 'P1 - Critical',
          ui_color: null,
          default_create: false,
          active: true,
          note: null,
        }),
      )
    })
  })

  describe('tags', () => {
    it('filters, adds, merges by renaming, and deletes tags; switches who may create tags', async () => {
      const calls = mockServer({
        'GET /api/v1/tag_list': () => ({
          body: [
            { id: 1, name: 'wifi', count: 30 },
            { id: 2, name: 'eduroam', count: 4 },
            { id: 3, name: 'printing', count: 0 },
          ],
        }),
        'GET /api/v1/studenthub/tag_settings': () => ({ body: { tag_new: true } }),
        'PUT /api/v1/studenthub/tag_settings': () => ({ body: { tag_new: false } }),
        'POST /api/v1/tag_list': () => ({ body: {} }),
        'PUT /api/v1/tag_list/2': () => ({ body: {} }),
        'DELETE /api/v1/tag_list/3': () => ({ body: {} }),
      })

      const view = render(Tags)
      await view.findByRole('listitem', { name: 'wifi' })

      await view.events.type(view.getByLabelText('Filter tags'), 'edu')
      expect(view.getAllByRole('listitem').map((item) => item.getAttribute('aria-label'))).toEqual(['eduroam'])
      await view.events.clear(view.getByLabelText('Filter tags'))

      await view.events.type(view.getByLabelText('New tag'), 'vle')
      await view.events.click(view.getByRole('button', { name: 'Add' }))
      await vi.waitFor(() => expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ name: 'vle' }))

      await view.events.click(view.getByRole('button', { name: 'Rename eduroam' }))
      const input = view.getByLabelText('New name')
      await view.events.clear(input)
      await view.events.type(input, 'wifi')
      await view.events.click(within(view.getByRole('listitem', { name: 'eduroam' })).getByRole('button', { name: 'Save' }))
      expect(mockConfirmation.plain).toHaveBeenCalledWith('A tag with this name exists. Merge the two into one?')
      await vi.waitFor(() => expect(calls.find((call) => call.url === '/api/v1/tag_list/2')?.body).toEqual({ id: 2, name: 'wifi' }))

      await view.events.click(view.getByRole('button', { name: 'Delete printing' }))
      await vi.waitFor(() => expect(calls.some((call) => call.method === 'DELETE')).toBe(true))

      await view.events.click(view.getByRole('switch', { name: 'Agents can create new tags' }))
      await vi.waitFor(() =>
        expect(calls.find((call) => call.url === '/api/v1/studenthub/tag_settings' && call.method === 'PUT')?.body).toEqual({
          tag_new: false,
        }),
      )
    })
  })
})
