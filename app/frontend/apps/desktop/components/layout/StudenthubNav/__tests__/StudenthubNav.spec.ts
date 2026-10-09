// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { within } from '@testing-library/vue'
import { computed, reactive, ref } from 'vue'

import renderComponent, { getTestRouter } from '#tests/support/components/renderComponent.ts'
import { mockPermissions } from '#tests/support/mock-permissions.ts'

import { EnumOrderDirection } from '#shared/graphql/types.ts'
import { convertToGraphQLId } from '#shared/graphql/utils.ts'

import { useSidebarDisplayStore } from '#desktop/components/layout/stores/sidebarDisplay.ts'
import { SidebarName } from '#desktop/components/layout/types.ts'
import { useTicketOverviewsStore } from '#desktop/entities/ticket/stores/ticketOverviews.ts'
import { mockDefaultOverviewQueries } from '#desktop/pages/ticket-overviews/__tests__/mocks/ticket-overviews-mocks.ts'

import { isTicketSectionRoute, railLink, type StudenthubRailRoute } from '../studenthubNav.ts'
import StudenthubNavPanel from '../StudenthubNavPanel.vue'
import StudenthubNavRail from '../StudenthubNavRail.vue'

import type { RouteLocationNormalizedLoaded, RouteRecordRaw } from 'vue-router'

const isManagerOnly = ref(false)

vi.mock('#desktop/composables/useStudenthubApprovalViewer.ts', () => ({
  useStudenthubApprovalViewer: () => ({
    isLoaded: computed(() => true),
    isManagerOnly: computed(() => isManagerOnly.value),
  }),
}))

vi.mock('#desktop/components/UserTaskbarTabs/UserTaskbarTabs.vue', () => ({
  default: {
    props: { collapsed: Boolean },
    template: '<div data-test-id="recent-tabs" :data-collapsed="String(collapsed)" />',
  },
}))

const hasTaskbarTabs = ref(false)

vi.mock('#desktop/entities/user/current/stores/taskbarTabs.ts', () => ({
  useUserCurrentTaskbarTabsStore: () => reactive({ hasTaskbarTabs, loading: ref(false) }),
}))

const page = { template: '<div />' }

const routerRoutes: RouteRecordRaw[] = [
  { path: '/', name: 'Home', component: page },
  { path: '/dashboard', name: 'Dashboard', component: page },
  { path: '/tickets/view/:overviewLink?', name: 'TicketOverview', component: page },
  { path: '/tickets/:internalId(\\d+)', name: 'TicketDetailView', component: page },
  { path: '/members', name: 'StudenthubMembers', component: page },
  { path: '/:pathMatch(.*)*', name: 'Error', component: page },
]

const sections = {
  teams: [{ overview_id: 2, group_id: 26 }],
  hidden_overview_ids: [],
  institution_overview_ids: [3],
  approval_overview_ids: [4],
}

const overview = (id: number, name: string, link: string, ticketCount: number) => ({
  id: convertToGraphQLId('Overview', id),
  name,
  link,
  prio: id,
  orderBy: 'created_at',
  orderDirection: EnumOrderDirection.Ascending,
  active: true,
  ticketCount,
})

const visit = async (path: string) => {
  await getTestRouter().push(path)
}

// Renders first: the test router only exists after the first render.
const renderRail = async (path = '/') => {
  const view = renderComponent(StudenthubNavRail, { router: true, routerRoutes, store: true })
  await visit(path)
  return view
}

const renderPanel = async (path = '/', currentViewLink?: string) => {
  if (currentViewLink) useTicketOverviewsStore().setCurrentTicketOverviewLink(currentViewLink)

  const view = renderComponent(StudenthubNavPanel, { router: true, routerRoutes, store: true })
  await visit(path)
  return view
}

const isPanelHidden = () => useSidebarDisplayStore().currentCollapsed[SidebarName.Primary]

describe('navigation design C', () => {
  beforeEach(() => {
    isManagerOnly.value = false
    hasTaskbarTabs.value = false
    mockPermissions(['ticket.agent', 'admin', 'knowledge_base.reader'])
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(sections), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
  })

  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  describe('helpers', () => {
    it('links a rail item to its page without optional parameters', () => {
      expect(railLink({ path: '/tickets/view/:overviewLink?' } as StudenthubRailRoute)).toBe(
        '/tickets/view',
      )
      expect(
        railLink({
          path: '/knowledge-base/:kind(category|answer)?/:id(\\d+)?',
        } as StudenthubRailRoute),
      ).toBe('/knowledge-base')
      expect(railLink({ path: '/members' } as StudenthubRailRoute)).toBe('/members')
    })

    it('counts ticket screens and New ticket as Tickets', () => {
      const at = (name: string, path: string) =>
        ({ name, path }) as unknown as RouteLocationNormalizedLoaded

      expect(isTicketSectionRoute(at('TicketDetailView', '/tickets/42'))).toBe(true)
      expect(isTicketSectionRoute(at('TicketCreate', '/tickets/create/abc'))).toBe(true)
      expect(isTicketSectionRoute(at('TicketOverview', '/tickets/view/my_assigned'))).toBe(true)
      expect(isTicketSectionRoute(at('Dashboard', '/dashboard'))).toBe(false)
    })
  })

  describe('rail', () => {
    it('lists the pages the user may open, with short labels', async () => {
      const view = await renderRail('/dashboard')

      const nav = view.getByRole('navigation', { name: 'Navigation' })

      expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
        'href',
        '/desktop/dashboard',
      )
      expect(within(nav).getByRole('link', { name: 'Tickets' })).toHaveAttribute(
        'href',
        '/desktop/tickets/view',
      )
      expect(within(nav).getByRole('link', { name: 'KB' })).toHaveAttribute(
        'href',
        '/desktop/knowledge-base',
      )
      expect(within(nav).getByRole('link', { name: 'Admin' })).toHaveAttribute(
        'href',
        '/desktop/manage',
      )
      expect(within(nav).getByRole('link', { name: 'Reports' })).toHaveAttribute(
        'href',
        '/desktop/report',
      )
      expect(within(nav).getByRole('link', { name: 'Members' })).toBeInTheDocument()
      expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
        'aria-current',
        'page',
      )
    })

    it('leaves out pages the user may not open', async () => {
      mockPermissions(['ticket.agent'])
      isManagerOnly.value = true

      const view = await renderRail()

      expect(view.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
      expect(view.queryByRole('link', { name: 'Members' })).not.toBeInTheDocument()
      expect(view.getByRole('link', { name: 'Tickets' })).toBeInTheDocument()
    })

    it('marks Tickets on a ticket screen', async () => {
      const view = await renderRail('/tickets/42')

      expect(view.getByRole('link', { name: 'Tickets' })).toHaveAttribute('aria-current', 'page')
      expect(view.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current')
    })

    it('offers Recent and Show panel only while the panel is hidden', async () => {
      const view = await renderRail()

      expect(view.queryByRole('button', { name: 'Show panel' })).not.toBeInTheDocument()
      expect(view.queryByTestId('recent-tabs')).not.toBeInTheDocument()

      useSidebarDisplayStore().setCollapsed(SidebarName.Primary, true)

      expect(await view.findByTestId('recent-tabs')).toHaveAttribute('data-collapsed', 'true')

      await view.events.click(view.getByRole('button', { name: 'Show panel' }))

      expect(isPanelHidden()).toBe(false)
    })
  })

  describe('panel', () => {
    beforeEach(() => {
      mockDefaultOverviewQueries([
        overview(1, 'My Assigned Tickets', 'my_assigned', 9),
        overview(2, 'Service Desk', 'studenthub_team_26', 12),
        overview(3, 'LSST', 'studenthub_institution_3', 7),
        overview(4, 'Awaiting my approval', 'awaiting_my_approval', 2),
      ])
    })

    it('lists the ticket views in groups on a ticket screen', async () => {
      const view = await renderPanel('/tickets/42', 'my_assigned')

      expect(view.getByRole('heading', { level: 2, name: 'Tickets' })).toBeInTheDocument()
      expect(view.getByTestId('studenthub-role')).toHaveTextContent('Admin')

      const approvals = await view.findByRole('navigation', { name: 'Approval views' })
      const waiting = within(approvals).getByRole('link', { name: /Awaiting my approval/ })

      expect(waiting).toHaveAttribute('href', '/desktop/tickets/view/awaiting_my_approval')
      // A view waiting for approval shows its count in amber.
      await vi.waitFor(() =>
        expect(waiting.querySelector('.sh-nav-views__count--waiting')).toBeInTheDocument(),
      )

      const teams = view.getByRole('navigation', { name: 'Team views' })
      expect(within(teams).getByRole('link', { name: /Service Desk/ })).toHaveAttribute(
        'href',
        '/desktop/tickets/view/studenthub_team_26',
      )

      const sites = view.getByRole('navigation', { name: 'Site views' })
      expect(within(sites).getByRole('link', { name: /LSST/ })).toBeInTheDocument()

      // The queue's view is marked, but this page is the ticket, not the view.
      const mine = view.getByRole('navigation', { name: 'Overview navigation list' })
      const assigned = within(mine).getByRole('link', { name: /My Assigned Tickets/ })

      expect(assigned).toHaveClass('sh-nav-views__item--active')
      expect(assigned).not.toHaveAttribute('aria-current')

      expect(view.getByTestId('recent-tabs')).toBeInTheDocument()
    })

    it('marks the open view on the Tickets page', async () => {
      const view = await renderPanel('/tickets/view/my_assigned', 'my_assigned')

      expect(await view.findByRole('link', { name: /My Assigned Tickets/ })).toHaveAttribute(
        'aria-current',
        'page',
      )
    })

    it('shows only Recent on other pages', async () => {
      const view = await renderPanel('/dashboard')

      expect(view.getByRole('heading', { level: 2, name: 'Dashboard' })).toBeInTheDocument()
      expect(view.queryByRole('navigation', { name: 'Team views' })).not.toBeInTheDocument()
      expect(view.getByTestId('recent-tabs')).toBeInTheDocument()
      expect(view.getByText('Tickets you open are listed here.')).toBeInTheDocument()
    })

    it('can be hidden', async () => {
      const view = await renderPanel()

      await view.events.click(view.getByRole('button', { name: 'Hide panel' }))

      expect(isPanelHidden()).toBe(true)
    })
  })
})
