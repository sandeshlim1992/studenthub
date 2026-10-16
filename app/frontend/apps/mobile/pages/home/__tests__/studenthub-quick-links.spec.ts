// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { within } from '@testing-library/vue'

import { visitView } from '#tests/support/components/visitView.ts'
import { mockApplicationConfig } from '#tests/support/mock-applicationConfig.ts'
import { mockGraphQLSubscription } from '#tests/support/mock-graphql-api.ts'
import { mockPermissions } from '#tests/support/mock-permissions.ts'

import { OnlineNotificationsCountDocument } from '#shared/entities/online-notification/graphql/subscriptions/onlineNotificationsCount.api.ts'

import {
  mockMyTickets,
  mockMyTicketsOverview,
} from '#mobile/entities/ticket/__tests__/mocks/studenthubMyTickets.ts'

// Student Hub: the admins' quick links on Home (Administration → Manage → Mobile app).
describe('Student Hub quick links on Home', () => {
  beforeEach(() => {
    mockPermissions(['ticket.customer'])
    mockGraphQLSubscription(OnlineNotificationsCountDocument)
    mockMyTicketsOverview()
    mockMyTickets([])
  })

  it('opens each website in a new tab and shows where it leads', async () => {
    mockApplicationConfig({
      studenthub_mobile_quick_links: [
        { label: 'Moodle', url: 'https://www.moodle.example.ac.uk/my/' },
        { label: 'Not a web address', url: 'javascript:alert(1)' },
        { label: 'Timetable', url: 'https://timetable.example.ac.uk' },
      ],
    })

    const view = await visitView('/')
    const section = within(view.getByRole('region', { name: 'Quick links' }))
    const links = section.getAllByRole('link')

    expect(links).toHaveLength(2)
    expect(within(links[0]).getByText('Moodle')).toBeInTheDocument()
    expect(within(links[0]).getByText('moodle.example.ac.uk')).toBeInTheDocument()
    expect(within(links[1]).getByText('Timetable')).toBeInTheDocument()
    expect(within(links[1]).getByText('timetable.example.ac.uk')).toBeInTheDocument()
    expect(links[0]).toHaveAttribute('href', 'https://www.moodle.example.ac.uk/my/')
    expect(links[0]).toHaveAttribute('target', '_blank')
    expect(links[0]).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('leaves the section out without links', async () => {
    mockApplicationConfig({ studenthub_mobile_quick_links: [] })

    const view = await visitView('/')

    expect(view.queryByRole('region', { name: 'Quick links' })).not.toBeInTheDocument()
  })
})
