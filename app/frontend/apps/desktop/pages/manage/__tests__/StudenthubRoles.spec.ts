// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { within } from '@testing-library/vue'

import { renderComponent } from '#tests/support/components/index.ts'

import { useNotifications } from '#shared/components/CommonNotifications/index.ts'
import { setCSRFToken } from '#shared/server/apollo/utils/csrfToken.ts'

import { permissionSections, toggleGroupAccess, type RolesOverview } from '../components/Roles/rolePermissions.ts'
import RoleEdit from '../views/RoleEdit.vue'
import Roles from '../views/Roles.vue'

const mockWaitForConfirmation = vi.hoisted(() => vi.fn())

vi.mock('#shared/composables/useConfirmation.ts', () => ({
  useConfirmation: () => ({ waitForConfirmation: mockWaitForConfirmation }),
}))

const permission = (id: number, name: string, label: string, extra = {}) => ({
  id,
  name,
  label,
  description: `${label} description`,
  disabled: false,
  required: [],
  groups: false,
  ...extra,
})

const overview = (): RolesOverview => ({
  roles: [
    {
      id: 2,
      name: 'Agent',
      note: 'All agents',
      active: true,
      default_at_signup: false,
      permission_ids: [60, 57],
      group_ids: { '26': ['full'], '27': ['read', 'change'] },
      user_count: 35,
    },
    {
      id: 1,
      name: 'Admin',
      note: null,
      active: true,
      default_at_signup: false,
      permission_ids: [1, 60],
      group_ids: {},
      user_count: 7,
    },
    {
      id: 3,
      name: 'Customer',
      note: null,
      active: true,
      default_at_signup: true,
      permission_ids: [61],
      group_ids: {},
      user_count: 2052,
    },
  ],
  permissions: [
    permission(1, 'admin', 'Admin interface'),
    permission(4, 'admin.role', 'Roles'),
    permission(59, 'ticket', 'Ticket', { disabled: true }),
    permission(60, 'ticket.agent', 'Agent tickets', { groups: true }),
    permission(61, 'ticket.customer', 'Customer tickets'),
    permission(57, 'knowledge_base.reader', 'Knowledge Base Reader'),
    permission(66, 'user_preferences.out_of_office', 'Out of Office', { required: ['ticket.agent'] }),
  ],
  groups: [
    { id: 26, name: 'Service Desk', active: true },
    { id: 27, name: 'VLE', active: true },
  ],
  my_role_ids: [1, 2],
})

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

const routes = [
  { path: '/', name: 'Home', component: { template: '<div />' } },
  { path: '/manage/roles', name: 'ManageRoles', component: { template: '<div />' } },
  { path: '/manage/roles/:roleId(\\d+|new)', name: 'ManageRole', component: { template: '<div />' } },
]

const renderView = async (component: typeof Roles, path: string) => {
  const view = renderComponent(component, {
    router: true,
    routerRoutes: routes,
    store: true,
    global: { stubs: { LayoutContent: { template: '<div><slot /></div>' } } },
  })
  await view.router.push(path)
  return view
}

describe('Roles', () => {
  beforeEach(() => {
    setCSRFToken('token-1')
    useNotifications().clearAllNotifications()
    mockWaitForConfirmation.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('groups permissions and leaves out the ones that cannot be given alone', () => {
    const sections = permissionSections(overview().permissions)

    expect(sections.map((section) => section.key)).toEqual(['admin', 'agent', 'customer', 'profile'])
    expect(sections.flatMap((section) => section.permissions.map((item) => item.name))).not.toContain('ticket')
  })

  it('treats full team access as everything', () => {
    expect(toggleGroupAccess(['read', 'change'], 'full')).toEqual(['full'])
    expect(toggleGroupAccess(['full'], 'read')).toEqual(['read'])
    expect(toggleGroupAccess(['read'], 'read')).toEqual([])
  })

  it('lists the roles with what they give and their users', async () => {
    mockServer({ 'GET /api/v1/studenthub/roles': () => ({ body: overview() }) })

    const view = await renderView(Roles, '/manage/roles')

    const agent = (await view.findByRole('link', { name: 'Agent' })).closest('tr')!
    expect(agent).toHaveTextContent('All agents')
    expect(agent).toHaveTextContent('Agent')
    expect(agent).toHaveTextContent('KB reader')
    expect(agent).toHaveTextContent('35')
    expect(view.getByRole('link', { name: 'Customer' }).closest('tr')).toHaveTextContent('New users get it')
    expect(view.getByRole('link', { name: 'Admin' }).closest('tr')).toHaveTextContent('Admin')
    expect(agent).not.toHaveTextContent('Admin')
  })

  it('changes permissions and team access of a role', async () => {
    const calls = mockServer({
      'GET /api/v1/studenthub/roles': () => ({ body: overview() }),
      'PUT /api/v1/roles/2': () => ({ body: { id: 2 } }),
    })

    const view = await renderView(RoleEdit, '/manage/roles/2')

    await vi.waitFor(() => expect(view.getByLabelText('Name')).toHaveValue('Agent'))
    expect(view.getByRole('checkbox', { name: /Agent tickets/ })).toBeChecked()

    const teams = view.getByRole('region', { name: 'Team access' })
    expect(within(teams).getByRole('checkbox', { name: 'Service Desk: Full' })).toBeChecked()
    expect(within(teams).getByRole('checkbox', { name: 'Service Desk: Read' })).toBeDisabled()

    await view.events.click(within(teams).getByRole('checkbox', { name: 'VLE: Full' }))
    await view.events.click(view.getByRole('checkbox', { name: /Out of Office/ }))
    await view.events.click(view.getByRole('button', { name: 'Save role' }))

    await vi.waitFor(() => expect(view.router.currentRoute.value.fullPath).toBe('/manage/roles'))
    expect(calls.find((call) => call.method === 'PUT')?.body).toEqual({
      name: 'Agent',
      note: 'All agents',
      active: true,
      default_at_signup: false,
      permission_ids: [60, 57, 66],
      group_ids: { '26': ['full'], '27': ['full'] },
    })
    expect(mockWaitForConfirmation).not.toHaveBeenCalled()
  })

  it('hides team access without agent tickets, and warns before taking away your own admin access', async () => {
    const calls = mockServer({
      'GET /api/v1/studenthub/roles': () => ({ body: overview() }),
      'PUT /api/v1/roles/1': () => ({ body: { id: 1 } }),
    })

    const view = await renderView(RoleEdit, '/manage/roles/1')
    await vi.waitFor(() => expect(view.getByLabelText('Name')).toHaveValue('Admin'))

    // "admin" includes "admin.role".
    expect(view.getByRole('checkbox', { name: /^Roles/ })).toBeDisabled()

    await view.events.click(view.getByRole('checkbox', { name: /Agent tickets/ }))
    expect(view.queryByRole('region', { name: 'Team access' })).not.toBeInTheDocument()

    await view.events.click(view.getByRole('checkbox', { name: /Admin interface/ }))
    await view.events.click(view.getByRole('button', { name: 'Save role' }))

    expect(mockWaitForConfirmation).toHaveBeenCalled()
    await vi.waitFor(() => expect(calls.some((call) => call.method === 'PUT')).toBe(true))
    expect(calls.find((call) => call.method === 'PUT')?.body).toMatchObject({ permission_ids: [], group_ids: {} })
  })

  it('creates a role', async () => {
    const calls = mockServer({
      'GET /api/v1/studenthub/roles': () => ({ body: overview() }),
      'POST /api/v1/roles': () => ({ status: 201, body: { id: 9 } }),
    })

    const view = await renderView(RoleEdit, '/manage/roles/new')
    await view.events.type(await view.findByLabelText('Name'), 'Night desk')
    await view.events.click(view.getByRole('checkbox', { name: /Agent tickets/ }))
    await view.events.click(within(view.getByRole('region', { name: 'Team access' })).getByRole('checkbox', { name: 'VLE: Read' }))
    await view.events.click(view.getByRole('button', { name: 'Save role' }))

    await vi.waitFor(() => expect(calls.some((call) => call.method === 'POST')).toBe(true))
    expect(calls.find((call) => call.method === 'POST')?.body).toMatchObject({
      name: 'Night desk',
      permission_ids: [60],
      group_ids: { '27': ['read'] },
    })
  })
})
