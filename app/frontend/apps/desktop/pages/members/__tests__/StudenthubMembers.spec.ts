// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { within } from '@testing-library/vue'

import { renderComponent } from '#tests/support/components/index.ts'
import { mockPermissions } from '#tests/support/mock-permissions.ts'

import StudenthubMembersButton from '#desktop/components/layout/StudenthubTopBar/StudenthubMembersButton.vue'
import type { StudenthubMember } from '#desktop/composables/useStudenthubMembers.ts'

import {
  arrangeStudenthubMembers,
  useStudenthubMembersFilter,
} from '../composables/useStudenthubMembersFilter.ts'
import StudenthubMembers from '../views/StudenthubMembers.vue'

const member = (attributes: Partial<StudenthubMember>): StudenthubMember => ({
  id: 1,
  firstname: 'Test',
  lastname: 'Agent',
  name: 'Test Agent',
  image: null,
  role: 'Agent',
  teams: ['Service Desk'],
  online: false,
  last_active_at: null,
  last_login: null,
  out_of_office: false,
  ...attributes,
})

const members = [
  member({ id: 2, name: 'Olivia Online', online: true, last_active_at: new Date().toISOString() }),
  member({
    id: 3,
    name: 'Victor VLE',
    teams: ['VLE'],
    role: 'Admin',
    last_login: '2026-10-06T14:20:00Z',
  }),
  member({ id: 4, name: 'Nina Never', teams: ['VLE'] }),
]

// Zammad's page layout needs a router view; the page's content is what is tested here.
const renderPage = () =>
  renderComponent(StudenthubMembers, {
    router: true,
    global: { stubs: { LayoutContent: { template: '<div><slot /></div>' } } },
  })

const roleHeadings = (region: HTMLElement) =>
  within(region)
    .queryAllByRole('heading', { level: 3 })
    .map((heading) => heading.textContent?.trim())

const names = (region: HTMLElement) =>
  within(region)
    .getAllByRole('listitem')
    .map((item) => item.querySelector('.font-semibold')?.firstChild?.textContent?.trim())

describe('Student Hub Members', () => {
  beforeEach(() => {
    const filter = useStudenthubMembersFilter()
    filter.clear()
    filter.setSort('role')

    mockPermissions(['ticket.agent'])
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ members }) }),
    )
  })

  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  describe('page', () => {
    it('lists who is online now and, for the others, when they last signed in', async () => {
      const view = renderPage()

      const online = await view.findByRole('region', { name: 'Online now (1)' })
      const offline = view.getByRole('region', { name: 'Offline (2)' })

      expect(online).toHaveTextContent('Olivia Online')
      expect(offline).toHaveTextContent('Victor VLE')
      expect(offline).toHaveTextContent('Last login')
      expect(offline).toHaveTextContent('Nina Never')
      expect(offline).toHaveTextContent('Never signed in')
    })

    it('finds members by name', async () => {
      const view = renderPage()
      await view.findByRole('region', { name: 'Online now (1)' })

      await view.events.type(view.getByLabelText('Search members'), 'victor')

      expect(view.getByRole('region', { name: 'Offline (1)' })).toHaveTextContent('Victor VLE')
      expect(view.getByRole('region', { name: 'Online now (0)' })).toHaveTextContent(
        'No one is online.',
      )
    })

    it('lists what the navigation panel filters, and clears it', async () => {
      const view = renderPage()
      await view.findByRole('region', { name: 'Online now (1)' })

      const filter = useStudenthubMembersFilter()
      filter.team.value = 'VLE'
      filter.role.value = 'Admin'

      expect(await view.findByRole('region', { name: 'Offline (1)' })).toHaveTextContent(
        'Victor VLE',
      )
      expect(view.queryByText('Olivia Online')).not.toBeInTheDocument()

      const summary = view.getByTestId('studenthub-members-filters')
      expect(summary).toHaveTextContent('Admin')
      expect(summary).toHaveTextContent('VLE')

      await view.events.click(view.getByRole('button', { name: 'Clear filters' }))

      expect(view.getByRole('region', { name: 'Offline (2)' })).toBeInTheDocument()
      expect(view.queryByTestId('studenthub-members-filters')).not.toBeInTheDocument()
    })

    it('leaves out the offline members when the panel shows who is online', async () => {
      const view = renderPage()
      await view.findByRole('region', { name: 'Online now (1)' })

      useStudenthubMembersFilter().show.value = 'online'

      await vi.waitFor(() =>
        expect(view.queryByRole('region', { name: /Offline/ })).not.toBeInTheDocument(),
      )
      expect(view.getByTestId('studenthub-members-filters')).toHaveTextContent('Online now')
    })

    it('groups the members by role, or sorts them by name or last activity', async () => {
      const view = renderPage()
      const offline = await view.findByRole('region', { name: 'Offline (2)' })

      expect(roleHeadings(offline)).toEqual(['Admin', 'Agent'])
      expect(names(offline)).toEqual(['Victor VLE', 'Nina Never'])

      await view.events.selectOptions(view.getByLabelText('Sort by'), 'name')

      expect(roleHeadings(offline)).toEqual([])
      expect(names(offline)).toEqual(['Nina Never', 'Victor VLE'])
      expect(localStorage.getItem('studenthub-members-sort')).toBe('name')

      await view.events.selectOptions(view.getByLabelText('Sort by'), 'last_active')

      expect(names(offline)).toEqual(['Victor VLE', 'Nina Never'])
    })

    it('says so when the members cannot be loaded', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

      const view = renderPage()

      expect(await view.findByRole('alert')).toHaveTextContent('The members could not be loaded.')
    })
  })

  describe('order', () => {
    it('puts the roles with the most rights first', () => {
      const list = [
        member({ id: 1, name: 'Ann', role: 'Agent' }),
        member({ id: 2, name: 'Bob', role: 'Agent & Manager' }),
        member({ id: 3, name: 'Cy', role: 'Admin' }),
        member({ id: 4, name: 'Di', role: 'Admin & Manager' }),
        member({ id: 5, name: 'Al', role: 'Agent' }),
      ]

      expect(
        arrangeStudenthubMembers(list, 'role').map((group) => [
          group.role,
          group.members.map((item) => item.name),
        ]),
      ).toEqual([
        ['Admin & Manager', ['Di']],
        ['Admin', ['Cy']],
        ['Agent & Manager', ['Bob']],
        ['Agent', ['Al', 'Ann']],
      ])
    })
  })

  describe('top bar button', () => {
    it('shows how many members are online and lists them', async () => {
      const view = renderComponent(StudenthubMembersButton, { router: true })

      const button = await view.findByRole('button', { name: 'Members online: 1' })
      await view.events.click(button)

      const list = await view.findByRole('list', { name: 'Online members' })
      expect(list).toHaveTextContent('Olivia Online')
      expect(list).not.toHaveTextContent('Victor VLE')
      expect(view.getByRole('link', { name: 'See all members →' })).toHaveAttribute(
        'href',
        expect.stringContaining('/members'),
      )
    })
  })
})
