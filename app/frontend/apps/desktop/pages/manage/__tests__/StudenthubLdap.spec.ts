// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { within } from '@testing-library/vue'

import { renderComponent } from '#tests/support/components/index.ts'

import { useNotifications } from '#shared/components/CommonNotifications/index.ts'
import { setCSRFToken } from '#shared/server/apollo/utils/csrfToken.ts'

import {
  fromGroupRoleRows,
  fromUserAttributeRows,
  mappingProblems,
  splitLdapHost,
  suggestedBaseDn,
  toGroupRoleRows,
  toUserAttributeRows,
} from '../components/Ldap/ldap.ts'
import Ldap from '../views/Ldap.vue'
import LdapSource from '../views/LdapSource.vue'

const mockWaitForVariantConfirmation = vi.hoisted(() => vi.fn())

vi.mock('#shared/composables/useConfirmation.ts', () => ({
  useConfirmation: () => ({ waitForVariantConfirmation: mockWaitForVariantConfirmation }),
}))

const options = {
  enabled: true,
  roles: [
    { id: 2, name: 'Agent' },
    { id: 3, name: 'Customer' },
  ],
  user_attributes: [
    { name: 'login', display: 'Login' },
    { name: 'firstname', display: 'First name' },
    { name: 'lastname', display: 'Last name' },
    { name: 'email', display: 'Email' },
    { name: 'phone', display: 'Phone' },
  ],
}

const source = {
  id: 4,
  name: 'College AD',
  active: true,
  prio: 1,
  preferences: {
    host: 'dc.example.ac.uk',
    ssl: 'ssl',
    ssl_verify: true,
    base_dn: 'dc=example,dc=ac,dc=uk',
    bind_user: 'cn=zammad,dc=example,dc=ac,dc=uk',
    bind_pw: '**********',
    user_uid: 'samaccountname',
    user_filter: '(objectClass=user)',
    group_uid: 'dn',
    group_filter: '(objectClass=group)',
    user_attributes: { samaccountname: 'login', mail: 'email' },
    group_role_map: { 'cn=it staff,dc=example,dc=ac,dc=uk': ['2'] },
    group_role_recursive: { 'cn=it staff,dc=example,dc=ac,dc=uk': true },
    unassigned_users: 'skip_sync',
  },
}

const bindAnswer = {
  result: 'ok',
  user_filter: '(objectClass=user)',
  user_uid: 'samaccountname',
  user_attributes: {
    samaccountname: 'samaccountname (e.g., jdoe)',
    givenname: 'givenname (e.g., Jane)',
    sn: 'sn (e.g., Doe)',
    mail: 'mail (e.g., jdoe@example.ac.uk)',
    telephonenumber: 'telephonenumber (e.g., 0207)',
  },
  group_filter: '(objectClass=group)',
  group_uid: 'dn',
  groups: { 'cn=it staff,dc=example,dc=ac,dc=uk': 'cn=it staff,dc=example,dc=ac,dc=uk' },
}

const mockServer = (routes: Record<string, () => { status?: number; body: unknown }>) => {
  const calls: { method: string; url: string; body?: Record<string, unknown> }[] = []
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
  { path: '/manage/system/integrations/ldap', name: 'ManageLdap', component: { template: '<div />' } },
  {
    path: '/manage/system/integrations/ldap/:sourceId(\\d+|new)',
    name: 'ManageLdapSource',
    component: { template: '<div />' },
  },
]

const renderView = async (component: typeof Ldap, path: string) => {
  const view = renderComponent(component, {
    router: true,
    routerRoutes: routes,
    store: true,
    global: { stubs: { LayoutContent: { template: '<div><slot /></div>' } } },
  })
  await view.router.push(path)
  return view
}

describe('LDAP', () => {
  beforeEach(() => {
    setCSRFToken('token-1')
    useNotifications().clearAllNotifications()
    mockWaitForVariantConfirmation.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('mapping', () => {
    it('suggests the Active Directory fields, and needs login', () => {
      const rows = toUserAttributeRows()
      expect(fromUserAttributeRows(rows)).toEqual({
        givenname: 'firstname',
        sn: 'lastname',
        mail: 'email',
        samaccountname: 'login',
        telephonenumber: 'phone',
      })
      expect(mappingProblems(rows)).toEqual([])
      expect(mappingProblems(rows.filter((row) => row.dest !== 'login'))).toEqual([
        "Attribute 'login' is required in the mapping",
      ])
    })

    it('turns group-to-role rows into Zammad settings and back', () => {
      const rows = toGroupRoleRows(source.preferences.group_role_map, source.preferences.group_role_recursive)
      expect(fromGroupRoleRows(rows)).toEqual({
        group_role_map: source.preferences.group_role_map,
        group_role_recursive: source.preferences.group_role_recursive,
      })
    })

    it('takes ldap:// and ldaps:// off the server and sets the encryption, as the classic wizard', () => {
      expect(splitLdapHost('ldaps://dc.example.ac.uk:636')).toEqual({ host: 'dc.example.ac.uk:636', ssl: 'ssl' })
      expect(splitLdapHost('ldap://10.0.0.5')).toEqual({ host: '10.0.0.5', ssl: 'off' })
      expect(splitLdapHost(' dc.example.ac.uk ')).toEqual({ host: 'dc.example.ac.uk' })
    })

    it('suggests the shortest naming context as base DN', () => {
      expect(suggestedBaseDn(['ou=people,dc=example,dc=ac,dc=uk', 'dc=example,dc=ac,dc=uk'])).toBe(
        'dc=example,dc=ac,dc=uk',
      )
    })
  })

  describe('overview', () => {
    it('shows the servers and the last sync, switches LDAP off and starts a sync', async () => {
      const calls = mockServer({
        'GET /api/v1/studenthub/ldap': () => ({ body: options }),
        'GET /api/v1/ldap_sources': () => ({ body: [source] }),
        'GET /api/v1/integration/ldap/job_start': () => ({
          body: {
            id: 1,
            started_at: '2026-10-07T08:00:00Z',
            finished_at: '2026-10-07T08:02:00Z',
            result: { created: 3, updated: 40, unchanged: 900, skipped: 2, failed: 0, deactivated: 1 },
          },
        }),
        'PUT /api/v1/studenthub/ldap': () => ({ body: { ...options, enabled: false } }),
        'POST /api/v1/integration/ldap/job_start': () => ({ body: { result: 'ok' } }),
      })

      const view = await renderView(Ldap, '/manage/system/integrations/ldap')

      expect(await view.findByRole('link', { name: 'College AD' })).toBeInTheDocument()
      expect(view.getByText(/dc.example.ac.uk ·/)).toHaveTextContent('SSL')
      const sync = view.getByRole('region', { name: 'Last sync' })
      expect(sync).toHaveTextContent('3 created')
      expect(sync).toHaveTextContent('40 updated')

      await view.events.click(view.getByRole('switch', { name: 'LDAP sync' }))
      await vi.waitFor(() => expect(calls.find((call) => call.method === 'PUT')?.body).toEqual({ enabled: false }))

      await view.events.click(within(sync).getByRole('button', { name: 'Sync now' }))
      await vi.waitFor(() =>
        expect(calls.some((call) => call.method === 'POST' && call.url === '/api/v1/integration/ldap/job_start')).toBe(true),
      )
    })
  })

  describe('setup', () => {
    it('connects, signs in, maps, tries and saves a new server', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      let tryPolls = 0
      const calls = mockServer({
        'GET /api/v1/studenthub/ldap': () => ({ body: options }),
        'POST /api/v1/integration/ldap/discover': () => ({
          body: { result: 'ok', attributes: { namingcontexts: ['ou=people,dc=example,dc=ac,dc=uk', 'dc=example,dc=ac,dc=uk'] } },
        }),
        'POST /api/v1/integration/ldap/bind': () => ({ body: bindAnswer }),
        'POST /api/v1/integration/ldap/job_try': () => ({ body: { result: 'ok' } }),
        'GET /api/v1/integration/ldap/job_try?finished=true': () => {
          tryPolls += 1
          return {
            body:
              tryPolls < 2
                ? { id: 9, started_at: '2026-10-07T08:00:00Z', finished_at: null, result: { sum: 10, total: 950 } }
                : {
                    id: 9,
                    started_at: '2026-10-07T08:00:00Z',
                    finished_at: '2026-10-07T08:01:00Z',
                    result: { created: 950, updated: 0, unchanged: 0, skipped: 0, failed: 0, deactivated: 0, role_ids: { '2': { created: 12 } } },
                  },
          }
        },
        'POST /api/v1/ldap_sources': () => ({ status: 201, body: { id: 5 } }),
      })

      const view = await renderView(LdapSource, '/manage/system/integrations/ldap/new')

      await view.events.type(await view.findByLabelText('Name'), 'College AD')
      await view.events.type(view.getByLabelText('Server'), 'ldaps://dc.example.ac.uk')
      await view.events.click(view.getByRole('button', { name: 'Connect' }))

      const baseDn = await view.findByLabelText('Base DN')
      expect(baseDn).toHaveValue('dc=example,dc=ac,dc=uk')
      await view.events.type(view.getByLabelText('Service account (bind user)'), 'cn=zammad,dc=example,dc=ac,dc=uk')
      await view.events.type(view.getByLabelText('Password'), 'secret')
      await view.events.click(view.getByRole('button', { name: 'Sign in' }))

      const groups = await view.findByRole('region', { name: 'Groups to roles' })
      await view.events.click(within(groups).getByRole('button', { name: 'Add a group' }))
      await view.events.type(within(groups).getByLabelText('LDAP group'), 'cn=it staff,dc=example,dc=ac,dc=uk')
      await view.events.selectOptions(within(groups).getByLabelText('Role'), '2')

      await view.events.click(view.getByRole('button', { name: 'Try it (changes nothing)' }))
      await vi.advanceTimersByTimeAsync(4500)

      const trial = await view.findByRole('region', { name: 'Trial run' })
      await vi.waitFor(() => expect(trial).toHaveTextContent('950 new users'))
      expect(trial).toHaveTextContent('Agent: 12 created')

      await view.events.click(within(trial).getByRole('button', { name: 'Save' }))
      await vi.waitFor(() => expect(calls.some((call) => call.url === '/api/v1/ldap_sources')).toBe(true))

      const saved = calls.find((call) => call.url === '/api/v1/ldap_sources')?.body
      expect(saved).toMatchObject({
        name: 'College AD',
        active: true,
        preferences: {
          host: 'dc.example.ac.uk',
          ssl: 'ssl',
          ssl_verify: true,
          base_dn: 'dc=example,dc=ac,dc=uk',
          bind_user: 'cn=zammad,dc=example,dc=ac,dc=uk',
          bind_pw: 'secret',
          user_uid: 'samaccountname',
          group_uid: 'dn',
          group_filter: '(objectClass=group)',
          user_filter: '(objectClass=user)',
          user_attributes: { samaccountname: 'login', mail: 'email', givenname: 'firstname', sn: 'lastname', telephonenumber: 'phone' },
          group_role_map: { 'cn=it staff,dc=example,dc=ac,dc=uk': ['2'] },
          group_role_recursive: { 'cn=it staff,dc=example,dc=ac,dc=uk': false },
          unassigned_users: 'sigup_roles',
        },
      })
      const bind = calls.find((call) => call.url === '/api/v1/integration/ldap/bind')?.body
      expect(bind).toMatchObject({ host: 'dc.example.ac.uk', ssl: 'ssl', base_dn: 'dc=example,dc=ac,dc=uk', bind_pw: 'secret' })
      vi.useRealTimers()
    })

    it('keeps the stored password of an existing server and says why a connection fails', async () => {
      const calls = mockServer({
        'GET /api/v1/studenthub/ldap': () => ({ body: options }),
        'GET /api/v1/ldap_sources/4': () => ({ body: source }),
        'POST /api/v1/integration/ldap/discover': () => ({ body: { result: 'ok', attributes: { namingcontexts: [] } } }),
        'POST /api/v1/integration/ldap/bind': () => ({ body: bindAnswer }),
        'PUT /api/v1/ldap_sources/4': () => ({ body: source }),
      })

      const view = await renderView(LdapSource, '/manage/system/integrations/ldap/4')
      await vi.waitFor(() => expect(view.getByLabelText('Name')).toHaveValue('College AD'))
      await view.events.click(view.getByRole('button', { name: 'Connect' }))
      await view.events.click(await view.findByRole('button', { name: 'Sign in' }))

      // The stored server id lets Zammad use the stored password behind the mask.
      expect(calls.find((call) => call.url === '/api/v1/integration/ldap/bind')?.body).toMatchObject({
        bind_pw: '**********',
        ldap_source_id: 4,
      })

      await view.events.click(await view.findByRole('button', { name: 'Save without trying' }))
      await vi.waitFor(() => expect(calls.some((call) => call.method === 'PUT')).toBe(true))
      expect(calls.find((call) => call.method === 'PUT')?.body).toMatchObject({
        preferences: {
          bind_pw: '**********',
          user_attributes: { samaccountname: 'login', mail: 'email' },
          group_role_recursive: { 'cn=it staff,dc=example,dc=ac,dc=uk': true },
          unassigned_users: 'skip_sync',
        },
      })
    })

    it('shows the server message when connecting fails', async () => {
      mockServer({
        'GET /api/v1/studenthub/ldap': () => ({ body: options }),
        'POST /api/v1/integration/ldap/discover': () => ({
          body: { result: 'failed', message: "Can't connect to 'dc.example.ac.uk' on port '636', Connection refused" },
        }),
      })

      const view = await renderView(LdapSource, '/manage/system/integrations/ldap/new')
      await view.events.type(await view.findByLabelText('Name'), 'College AD')
      await view.events.type(view.getByLabelText('Server'), 'dc.example.ac.uk')
      await view.events.click(view.getByRole('button', { name: 'Connect' }))

      expect(await view.findByRole('alert')).toHaveTextContent('Connection refused')
    })
  })
})
