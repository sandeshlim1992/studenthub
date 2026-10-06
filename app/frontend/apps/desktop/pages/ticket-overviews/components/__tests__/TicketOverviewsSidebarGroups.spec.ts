// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { within } from '@testing-library/vue'

import renderComponent from '#tests/support/components/renderComponent.ts'
import { mockPermissions } from '#tests/support/mock-permissions.ts'

import { EnumOrderDirection } from '#shared/graphql/types.ts'
import { convertToGraphQLId } from '#shared/graphql/utils.ts'

import TicketOverviewsSidebar from '#desktop/pages/ticket-overviews/components/TicketOverviewsSidebar.vue'
import { sectionOfOverview } from '#desktop/pages/ticket-overviews/composables/useStudenthubTicketViews.ts'

import { mockDefaultOverviewQueries } from '../../__tests__/mocks/ticket-overviews-mocks.ts'

const sections = {
  teams: [{ overview_id: 2, group_id: 26 }],
  hidden_overview_ids: [3],
  institution_overview_ids: [4],
  approval_overview_ids: [5],
}

const overview = (id: number, name: string, link: string) => ({
  id: convertToGraphQLId('Overview', id),
  name,
  link,
  prio: id,
  orderBy: 'created_at',
  orderDirection: EnumOrderDirection.Ascending,
  active: true,
  ticketCount: id,
})

describe('views panel groups', () => {
  it('sorts overviews into approvals, my views, teams and institutions', () => {
    expect(sectionOfOverview(1, sections)).toBe('mine')
    expect(sectionOfOverview(2, sections)).toBe('teams')
    expect(sectionOfOverview(3, sections)).toBeNull()
    expect(sectionOfOverview(4, sections)).toBe('institutions')
    expect(sectionOfOverview(5, sections)).toBe('approvals')
  })

  it('keeps everything under my views until the grouping is known', () => {
    expect(sectionOfOverview(2, null)).toBe('mine')
  })

  it('shows the groups in the sidebar', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(sections), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      ),
    )
    mockPermissions(['ticket.agent'])
    mockDefaultOverviewQueries([
      overview(1, 'My ALL Tickets', 'my_assigned'),
      overview(2, 'Service Desk', 'service_desk'),
      overview(3, 'VLE Desk', 'vle_desk'),
      overview(4, 'LSST', 'studenthub_institution_lsst'),
      overview(5, 'Awaiting my approval', 'awaiting_my_approval'),
    ])

    const view = renderComponent(TicketOverviewsSidebar, { router: true })

    const teams = await view.findByRole('navigation', { name: 'Team views' })
    expect(within(teams).getByRole('link', { name: /Service Desk/ })).toBeInTheDocument()

    const institutions = view.getByRole('navigation', { name: 'Institution views' })
    expect(within(institutions).getByRole('link', { name: /LSST/ })).toBeInTheDocument()

    const approvals = view.getByRole('navigation', { name: 'Approval views' })
    expect(within(approvals).getByRole('link', { name: /Awaiting my approval/ })).toBeInTheDocument()
    expect(view.getByText('Approval needed')).toBeInTheDocument()

    const mine = view.getByRole('navigation', { name: 'Overview navigation list' })
    expect(within(mine).getByRole('link', { name: /My ALL Tickets/ })).toBeInTheDocument()
    expect(view.queryByText('VLE Desk')).not.toBeInTheDocument()

    vi.unstubAllGlobals()
  })
})
