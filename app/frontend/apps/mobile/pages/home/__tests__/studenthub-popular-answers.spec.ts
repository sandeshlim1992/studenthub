// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { within } from '@testing-library/vue'

import { visitView } from '#tests/support/components/visitView.ts'
import { mockGraphQLSubscription } from '#tests/support/mock-graphql-api.ts'
import { mockPermissions } from '#tests/support/mock-permissions.ts'

import { OnlineNotificationsCountDocument } from '#shared/entities/online-notification/graphql/subscriptions/onlineNotificationsCount.api.ts'

import {
  mockMyTickets,
  mockMyTicketsOverview,
} from '#mobile/entities/ticket/__tests__/mocks/studenthubMyTickets.ts'

const mockPopularAnswers = (reply: () => Response) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === '/api/v1/studenthub/mobile_app/popular_answers') return reply()
      throw new Error(`calling fetch on ${url}`)
    }),
  )
}

// Student Hub: the admins' popular answers on Home (Administration → Manage → Mobile app).
describe('Student Hub popular answers on Home', () => {
  beforeEach(() => {
    mockPermissions(['ticket.customer'])
    mockGraphQLSubscription(OnlineNotificationsCountDocument)
    mockMyTicketsOverview()
    mockMyTickets([])
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('links each answer to its help center page', async () => {
    mockPopularAnswers(
      () =>
        new Response(
          JSON.stringify([
            { id: 2, title: 'Reset your password', url: '/help/en-us/1-accounts/2-reset-your-password' },
            { id: 1, title: 'Connect to the Wi-Fi', url: '/help/en-us/6-how-to/1-connect-to-the-wi-fi' },
          ]),
        ),
    )

    const view = await visitView('/')
    const section = within(await view.findByRole('region', { name: 'Popular answers' }))
    const links = section.getAllByRole('link')

    expect(links.map((link) => link.textContent?.trim())).toEqual([
      'Reset your password',
      'Connect to the Wi-Fi',
    ])
    expect(links[0]).toHaveAttribute('href', '/help/en-us/1-accounts/2-reset-your-password')
  })

  it.each([
    ['there are none', () => new Response(JSON.stringify([]))],
    ['they cannot be loaded', () => new Response('{}', { status: 500 })],
  ])('leaves the section out when %s', async (_, reply) => {
    mockPopularAnswers(reply)
    const view = await visitView('/')

    await view.findByRole('link', { name: 'Search…' })
    expect(view.queryByRole('region', { name: 'Popular answers' })).not.toBeInTheDocument()
  })
})
