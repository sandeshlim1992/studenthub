// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { renderComponent } from '#tests/support/components/index.ts'
import { mockPermissions } from '#tests/support/mock-permissions.ts'

import StudenthubMembersButton from '#desktop/components/layout/StudenthubTopBar/StudenthubMembersButton.vue'
import type { StudenthubMember } from '#desktop/composables/useStudenthubMembers.ts'

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
  member({ id: 3, name: 'Victor VLE', teams: ['VLE'], role: 'Admin', last_login: '2026-10-06T14:20:00Z' }),
  member({ id: 4, name: 'Nina Never', teams: ['VLE'] }),
]

// Zammad's page layout needs a router view; the page's content is what is tested here.
const renderPage = () =>
  renderComponent(StudenthubMembers, {
    router: true,
    global: { stubs: { LayoutContent: { template: '<div><slot /></div>' } } },
  })

describe('Student Hub Members', () => {
  beforeEach(() => {
    mockPermissions(['ticket.agent'])
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ members }) }),
    )
  })

  afterEach(() => {
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

    it('finds members by name and team', async () => {
      const view = renderPage()
      await view.findByRole('region', { name: 'Online now (1)' })

      await view.events.type(view.getByLabelText('Search members'), 'victor')

      expect(view.getByRole('region', { name: 'Offline (1)' })).toHaveTextContent('Victor VLE')
      expect(view.getByRole('region', { name: 'Online now (0)' })).toHaveTextContent('No one is online.')

      await view.events.clear(view.getByLabelText('Search members'))
      await view.events.selectOptions(view.getByLabelText('Team'), 'VLE')

      expect(view.getByRole('region', { name: 'Offline (2)' })).toBeInTheDocument()
      expect(view.queryByText('Olivia Online')).not.toBeInTheDocument()
    })

    it('says so when the members cannot be loaded', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

      const view = renderPage()

      expect(await view.findByRole('alert')).toHaveTextContent('The members could not be loaded.')
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
