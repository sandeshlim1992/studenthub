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
import {
  resetStudenthubKnowledgeBase,
  useStudenthubKnowledgeBase,
} from '#desktop/pages/knowledge-base/composables/useStudenthubKnowledgeBase.ts'
import { useStudenthubMembersFilter } from '#desktop/pages/members/composables/useStudenthubMembersFilter.ts'
import { mockDefaultOverviewQueries } from '#desktop/pages/ticket-overviews/__tests__/mocks/ticket-overviews-mocks.ts'

import { isTicketSectionRoute, railLink, type StudenthubRailRoute } from '../studenthubNav.ts'
import StudenthubNavPanel from '../StudenthubNavPanel.vue'
import StudenthubNavRail from '../StudenthubNavRail.vue'

import type { RouteLocationNormalizedLoaded, RouteRecordRaw } from 'vue-router'

const isManagerOnly = ref(false)
const isApprover = ref(true)

vi.mock('#desktop/composables/useStudenthubApprovalViewer.ts', () => ({
  useStudenthubApprovalViewer: () => ({
    isLoaded: computed(() => true),
    isManagerOnly: computed(() => isManagerOnly.value),
    isApprover: computed(() => isApprover.value),
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
  {
    path: '/knowledge-base/:kind(category|answer)?/:id(\\d+)?/:mode(edit|new)?',
    name: 'StudenthubKnowledgeBase',
    component: page,
  },
  {
    path: '/personal-setting',
    name: 'PersonalSetting',
    component: page,
    meta: { title: 'Profile', requiresAuth: true, requiredPermission: null },
  },
  { path: '/:pathMatch(.*)*', name: 'Error', component: page },
]

const sections = {
  teams: [{ overview_id: 2, group_id: 26 }],
  hidden_overview_ids: [],
  institution_overview_ids: [3],
  approval_overview_ids: [4],
}

const members = [
  {
    id: 7,
    firstname: 'Ada',
    lastname: 'Lovelace',
    name: 'Ada Lovelace',
    image: null,
    role: 'Agent',
    teams: ['Service Desk'],
    online: true,
    last_active_at: null,
    last_login: null,
    out_of_office: false,
  },
  {
    id: 8,
    firstname: 'Alan',
    lastname: 'Turing',
    name: 'Alan Turing',
    image: null,
    role: 'Agent',
    teams: [],
    online: false,
    last_active_at: null,
    last_login: null,
    out_of_office: false,
  },
]

const knowledgeBase = {
  knowledge_base: {
    id: 3,
    active: true,
    titles: { '4': 'IT Help' },
    locales: [{ id: 4, locale: 'en-us', name: 'English (United States)', primary: true }],
    can_create_category: true,
  },
  categories: [
    {
      id: 6,
      parent_id: null,
      position: 0,
      icon: 'f0eb',
      titles: { '4': 'How-To Guides' },
      translation_ids: { '4': 60 },
      editable: true,
    },
    {
      id: 7,
      parent_id: 6,
      position: 0,
      icon: 'f1eb',
      titles: { '4': 'Wi-Fi' },
      translation_ids: { '4': 70 },
      editable: true,
    },
    {
      id: 8,
      parent_id: null,
      position: 1,
      icon: 'f128',
      titles: { '4': 'FAQs' },
      translation_ids: { '4': 80 },
      editable: true,
    },
  ],
  answers: [
    {
      id: 12,
      category_id: 7,
      position: 0,
      promoted: false,
      state: 'internal',
      titles: { '4': 'Eduroam setup' },
      updated_at: '2026-10-05T10:00:00Z',
      editable: true,
    },
    {
      id: 13,
      category_id: 8,
      position: 0,
      promoted: false,
      state: 'draft',
      titles: { '4': 'Printing on campus' },
      updated_at: '2026-09-01T10:00:00Z',
      editable: true,
    },
  ],
}

const respond = (url: string) => {
  if (url.includes('/studenthub/members')) return Response.json({ members }, { status: 200 })
  if (url.includes('/studenthub/knowledge_base'))
    return Response.json(knowledgeBase, { status: 200 })
  return Response.json(sections, { status: 200 })
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
    isApprover.value = true
    hasTaskbarTabs.value = false
    mockPermissions(['ticket.agent', 'admin', 'knowledge_base.reader'])
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => respond(url)),
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

    it('offers Recent on the Dashboard, Members and Knowledge Base pages, whose panels have none', async () => {
      const view = await renderRail('/dashboard')

      expect(view.queryByRole('button', { name: 'Show panel' })).not.toBeInTheDocument()
      expect(await view.findByTestId('recent-tabs')).toHaveAttribute('data-collapsed', 'true')

      await visit('/members')

      expect(view.getByTestId('recent-tabs')).toHaveAttribute('data-collapsed', 'true')

      await visit('/knowledge-base')

      expect(view.getByTestId('recent-tabs')).toHaveAttribute('data-collapsed', 'true')

      await visit('/tickets/view')

      expect(view.queryByTestId('recent-tabs')).not.toBeInTheDocument()
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

    it('shows the dashboards, what needs attention and who is online on the Dashboard', async () => {
      const view = await renderPanel('/dashboard')

      expect(view.getByRole('heading', { level: 2, name: 'Dashboard' })).toBeInTheDocument()

      const dashboards = view.getByRole('group', { name: 'Dashboard view' })
      expect(
        within(dashboards)
          .getAllByRole('button')
          .map((button) => button.querySelector('.sh-nav-views__name')?.textContent),
      ).toEqual(['Team overview', 'My work', 'Approvals'])
      expect(within(dashboards).getByRole('button', { name: /Team overview/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      )

      await view.events.click(within(dashboards).getByRole('button', { name: /My work/ }))

      expect(within(dashboards).getByRole('button', { name: /My work/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      expect(localStorage.getItem('studenthub-dashboard-view')).toBe('mine')

      const attention = await view.findByRole('navigation', { name: 'Needs attention' })
      expect(
        within(attention)
          .getAllByRole('link')
          .map((link) => link.getAttribute('href')),
      ).toEqual(['/desktop/tickets/view/awaiting_my_approval', '/desktop/tickets/view/my_assigned'])

      const online = await view.findByRole('list', { name: 'Online members' })
      expect(within(online).getByText('Ada Lovelace')).toBeInTheDocument()
      expect(within(online).queryByText('Alan Turing')).not.toBeInTheDocument()
      expect(view.getByText('Online now (1)')).toBeInTheDocument()

      expect(view.queryByTestId('recent-tabs')).not.toBeInTheDocument()
    })

    it('leaves out who is online for managers without another staff role', async () => {
      isManagerOnly.value = true

      const view = await renderPanel('/dashboard')

      expect(view.getByRole('heading', { level: 2, name: 'Dashboard' })).toBeInTheDocument()
      expect(view.queryByRole('list', { name: 'Online members' })).not.toBeInTheDocument()
      expect(view.queryByText(/Online now/)).not.toBeInTheDocument()
    })

    it('filters the Members page by who, role and team', async () => {
      const filter = useStudenthubMembersFilter()
      filter.clear()

      const view = await renderPanel('/members')

      expect(view.getByRole('heading', { level: 2, name: 'Members' })).toBeInTheDocument()

      const shows = view.getByRole('group', { name: 'Show members' })
      expect(within(shows).getByRole('button', { name: /Everyone/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      await vi.waitFor(() =>
        expect(within(shows).getByRole('button', { name: /Online now/ })).toHaveTextContent('1'),
      )

      await view.events.click(within(shows).getByRole('button', { name: /Online now/ }))

      expect(filter.show.value).toBe('online')

      const roles = view.getByRole('group', { name: 'Filter by role' })
      const agent = within(roles).getByRole('button', { name: /Agent/ })
      expect(agent).toHaveTextContent('1 of 2 online')

      await view.events.click(agent)

      expect(filter.role.value).toBe('Agent')
      expect(agent).toHaveAttribute('aria-pressed', 'true')

      await view.events.click(agent)

      expect(filter.role.value).toBe('')

      const teams = view.getByRole('group', { name: 'Filter by team' })
      await view.events.click(within(teams).getByRole('button', { name: /Service Desk/ }))

      expect(filter.team.value).toBe('Service Desk')
      expect(view.queryByTestId('recent-tabs')).not.toBeInTheDocument()

      filter.clear()
    })

    it('shows the Knowledge Base categories, with a filter by title', async () => {
      await useStudenthubKnowledgeBase().load()

      const view = await renderPanel('/knowledge-base/answer/12')

      expect(view.getByRole('heading', { level: 2, name: 'Knowledge Base' })).toBeInTheDocument()

      const categories = view.getByRole('navigation', { name: 'Categories' })
      expect(within(categories).getByRole('link', { name: /^Wi-Fi/ })).toHaveAttribute(
        'aria-current',
        'page',
      )
      expect(within(categories).getByRole('link', { name: /^FAQs/ })).not.toHaveAttribute(
        'aria-current',
      )

      await view.events.type(view.getByPlaceholderText('Filter by title…'), 'print')

      const matches = view.getByRole('navigation', { name: 'Matching titles' })
      expect(within(matches).getByRole('link', { name: /Printing on campus/ })).toBeInTheDocument()
      expect(view.queryByRole('navigation', { name: 'Categories' })).not.toBeInTheDocument()
      expect(view.queryByTestId('recent-tabs')).not.toBeInTheDocument()
      expect(view.queryByRole('button', { name: 'New category' })).not.toBeInTheDocument()

      resetStudenthubKnowledgeBase()
    })

    it('shows only Recent on other pages', async () => {
      const view = await renderPanel('/personal-setting')

      expect(view.getByRole('heading', { level: 2, name: 'Profile' })).toBeInTheDocument()
      expect(view.queryByRole('navigation', { name: 'Team views' })).not.toBeInTheDocument()
      expect(view.queryByRole('group', { name: 'Show members' })).not.toBeInTheDocument()
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
