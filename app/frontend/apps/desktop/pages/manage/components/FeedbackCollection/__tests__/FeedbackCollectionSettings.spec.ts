// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { waitFor } from '@testing-library/vue'

import renderComponent from '#tests/support/components/renderComponent.ts'

import FeedbackCollectionSettings from '../FeedbackCollectionSettings.vue'

import type { FeedbackSettings } from '../types.ts'

const settings: FeedbackSettings = {
  enabled: false,
  config: {
    channel_id: null,
    from_name: 'Student Hub Feedback',
    from_email: 'feedback@studenthub.ac',
    reply_to: 'feedback@studenthub.ac',
    notify_email: '',
    group_ids: [],
    require_owner: true,
    skip_tags: ['spam'],
    resend_after_days: 0,
    add_internal_note: true,
  },
  subject: 'Service Feedback Request: Ticket #{{ticket_number}}',
  template: '<p>{{link_1}}</p>',
  template_custom: false,
  default_template: '<p>{{link_1}}</p>',
  placeholders: ['ticket_number', 'link_1'],
  channels: [
    { id: 5, area: 'MicrosoftGraph::Account', active: true, adapter: 'microsoft_graph_outbound', label: 'it@studenthub.ac · MicrosoftGraph' },
    { id: 6, area: 'Email::Account', active: false, adapter: 'smtp', label: 'old@studenthub.ac · Email' },
  ],
  groups: [
    { id: 1, name: 'Service Desk', active: true },
    { id: 2, name: 'VLE', active: true },
  ],
  feedback_url: 'https://ticket.studenthub.ac/feedback/',
}

describe('FeedbackCollectionSettings', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit = {}) =>
      Promise.resolve(
        new Response(JSON.stringify(init.method === 'PUT' ? { ...settings, enabled: true } : {}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('saves the switch, channel, groups and tags', async () => {
    const view = renderComponent(FeedbackCollectionSettings, { props: { settings } })

    await view.events.click(view.getByLabelText('Send feedback requests', { exact: false }))
    await view.events.selectOptions(view.getByLabelText('Send through', { exact: false }), '5')
    await view.events.click(view.getByLabelText('VLE'))
    const tags = view.getByLabelText('Skip tickets with these tags', { exact: false })
    await view.events.clear(tags)
    await view.events.type(tags, 'spam, no-survey')
    await view.events.click(view.getByRole('button', { name: 'Save settings' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/feedback_collection/settings')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body)).toMatchObject({
      enabled: true,
      config: { channel_id: 5, group_ids: [2], skip_tags: ['spam', 'no-survey'] },
    })
    expect(await view.findByText('Settings saved.')).toBeInTheDocument()
    expect(view.emitted('saved')).toHaveLength(1)
  })

  it('warns when an inactive channel is chosen', async () => {
    const view = renderComponent(FeedbackCollectionSettings, { props: { settings } })

    await view.events.selectOptions(view.getByLabelText('Send through', { exact: false }), '6')

    expect(view.getByText('This channel is inactive, so no feedback emails can be sent through it.')).toBeInTheDocument()
  })

  it('shows the server error when sending a test email fails', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'No email channel is selected for feedback requests.' }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const view = renderComponent(FeedbackCollectionSettings, { props: { settings } })

    await view.events.click(view.getByRole('button', { name: 'Send test email' }))

    expect(await view.findByText('No email channel is selected for feedback requests.')).toBeInTheDocument()
  })
})
