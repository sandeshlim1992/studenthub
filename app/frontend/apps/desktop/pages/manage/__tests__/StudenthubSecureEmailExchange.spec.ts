// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { within } from '@testing-library/vue'

import { renderComponent } from '#tests/support/components/index.ts'

import { useNotifications } from '#shared/components/CommonNotifications/index.ts'
import { setCSRFToken } from '#shared/server/apollo/utils/csrfToken.ts'

import { exchangeResultMessage } from '../components/Exchange/exchange.ts'
import Exchange from '../views/Exchange.vue'
import SecureEmail from '../views/SecureEmail.vue'

const mockConfirmation = vi.hoisted(() => ({ variant: vi.fn(), plain: vi.fn() }))

vi.mock('#shared/composables/useConfirmation.ts', () => ({
  useConfirmation: () => ({
    waitForVariantConfirmation: mockConfirmation.variant,
    waitForConfirmation: mockConfirmation.plain,
  }),
}))

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
  { path: '/manage/system/integrations/exchange', name: 'ManageExchange', component: { template: '<div />' } },
]

const render = async (component: typeof Exchange, props: Record<string, unknown> = {}, path = '/') => {
  const view = renderComponent(component, {
    props,
    router: true,
    routerRoutes: routes,
    store: true,
    global: { stubs: { LayoutContent: { template: '<div><slot /></div>' } } },
  })
  await view.router.push(path)
  return view
}

const settings = {
  enabled: true,
  sign_system_notifications: false,
  recipient_alias: false,
  groups: [
    { id: 26, name: 'Service Desk', sign: true, encryption: false },
    { id: 27, name: 'VLE', sign: false, encryption: false },
  ],
}

describe('S/MIME, PGP and Exchange pages', () => {
  beforeEach(() => {
    setCSRFToken('token-1')
    useNotifications().clearAllNotifications()
    mockConfirmation.variant.mockResolvedValue(true)
    mockConfirmation.plain.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('S/MIME', () => {
    it('lists certificates, adds one and saves the team defaults', async () => {
      const calls = mockServer({
        'GET /api/v1/studenthub/integrations/smime': () => ({ body: settings }),
        'PUT /api/v1/studenthub/integrations/smime': () => ({ body: settings }),
        'GET /api/v1/integration/smime/certificate': () => ({
          body: [
            {
              id: 5,
              subject: '/CN=IT Service Desk',
              fingerprint: 'AB:CD',
              not_before_at: '2025-01-01T00:00:00Z',
              not_after_at: '2027-01-01T00:00:00Z',
              private_key: '-----BEGIN PRIVATE KEY-----',
              subject_alternative_name: 'it@example.ac.uk',
              usage: ['Signature', 'Encryption'],
            },
          ],
        }),
        'POST /api/v1/integration/smime/certificate': () => ({ body: { result: 'ok' } }),
      })

      const view = await render(SecureEmail, { kind: 'smime' })

      const certificate = await view.findByRole('listitem', { name: 'it@example.ac.uk' })
      expect(certificate).toHaveTextContent('With private key (can sign / decrypt)')
      expect(within(certificate).getByRole('link', { name: 'Download certificate' })).toHaveAttribute(
        'href',
        '/api/v1/integration/smime/certificate_download/5',
      )

      await view.events.click(view.getByRole('button', { name: 'Add certificate' }))
      await view.events.type(view.getByLabelText('Text'), '-----BEGIN CERTIFICATE-----')
      await view.events.click(within(view.getByRole('form', { name: 'Add' })).getByRole('button', { name: 'Add' }))
      await vi.waitFor(() =>
        expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ certificate: '-----BEGIN CERTIFICATE-----' }),
      )

      await view.events.click(view.getByRole('checkbox', { name: 'VLE: encrypt' }))
      await view.events.click(view.getByRole('button', { name: 'Save defaults' }))
      await vi.waitFor(() =>
        expect(calls.find((call) => call.method === 'PUT')?.body).toEqual({
          groups: [
            { id: 26, name: 'Service Desk', sign: true, encryption: false },
            { id: 27, name: 'VLE', sign: false, encryption: true },
          ],
        }),
      )
    })
  })

  describe('PGP', () => {
    it('lists keys, warns about GnuPG and adds a key with its passphrase', async () => {
      const calls = mockServer({
        'GET /api/v1/studenthub/integrations/pgp': () => ({ body: settings }),
        'GET /api/v1/integration/pgp/key': () => ({
          body: [
            {
              id: 3,
              name: 'IT <it@example.ac.uk>',
              email_addresses: ['it@example.ac.uk'],
              fingerprint: '1234ABCD',
              expires_at: null,
              secret: false,
              domain_alias: null,
            },
          ],
        }),
        'GET /api/v1/integration/pgp/status': () => ({ body: { error: 'gpg (GnuPG) 2.2.0 or newer is required' } }),
        'POST /api/v1/integration/pgp/key': () => ({ status: 201, body: { id: 4 } }),
      })

      const view = await render(SecureEmail, { kind: 'pgp' })

      const key = await view.findByRole('listitem', { name: 'it@example.ac.uk' })
      expect(key).toHaveTextContent('Public only (can encrypt / verify)')
      expect(view.getByText('gpg (GnuPG) 2.2.0 or newer is required')).toBeInTheDocument()

      await view.events.click(view.getByRole('button', { name: 'Add key' }))
      await view.events.type(view.getByLabelText('Text'), '-----BEGIN PGP PRIVATE KEY BLOCK-----')
      await view.events.type(view.getByLabelText('Passphrase (private keys only)'), 'pass')
      await view.events.click(within(view.getByRole('form', { name: 'Add' })).getByRole('button', { name: 'Add' }))

      await vi.waitFor(() =>
        expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
          private_key: '-----BEGIN PGP PRIVATE KEY BLOCK-----',
          passphrase: 'pass',
        }),
      )
    })
  })

  describe('Exchange', () => {
    const exchangeSettings = {
      enabled: false,
      config: { auth_type: 'oauth', endpoint: '', folders: [], attributes: {}, password: '' },
      app: { id: 2, client_id: 'abc-123', client_tenant: 'tenant-1' },
      account: { user: 'it@example.ac.uk', connected_at: '2026-10-07T10:00:00Z' },
      callback_url: 'https://helpdesk.example/api/v1/external_credentials/exchange/callback',
      user_attributes: [
        { name: 'firstname', display: 'First name' },
        { name: 'lastname', display: 'Last name' },
        { name: 'email', display: 'Email' },
        { name: 'phone', display: 'Phone' },
      ],
    }

    it('loads folders and fields, tries it and saves', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      let polls = 0
      const calls = mockServer({
        'GET /api/v1/studenthub/integrations/exchange': () => ({ body: exchangeSettings }),
        'GET /api/v1/integration/exchange/job_start': () => ({ body: {} }),
        'POST /api/v1/integration/exchange/folders': () => ({ body: { result: 'ok', folders: { AAMk1: 'Contacts', AAMk2: 'Contacts/Staff' } } }),
        'POST /api/v1/integration/exchange/mapping': () => ({
          body: { result: 'ok', attributes: { given_name: 'Jane', surname: 'Doe', 'email_addresses.emailaddress1': 'jane@example.ac.uk' } },
        }),
        'POST /api/v1/integration/exchange/job_try': () => ({ body: { result: 'ok' } }),
        'GET /api/v1/integration/exchange/job_try?finished=true': () => {
          polls += 1
          return {
            body: polls < 2 ? { finished_at: null, result: { sum: 1, total: 10 } } : { finished_at: '2026-10-07T10:05:00Z', result: { created: 10, updated: 0 } },
          }
        },
        'PUT /api/v1/studenthub/integrations/exchange': () => ({ body: exchangeSettings }),
      })

      const view = await render(Exchange)

      expect(await view.findByText('Connected as it@example.ac.uk')).toBeInTheDocument()
      expect(view.getByLabelText('EWS address')).toHaveValue('https://outlook.office365.com/EWS/Exchange.asmx')

      await view.events.click(view.getByRole('button', { name: 'Load folders' }))
      await view.events.click(await view.findByLabelText('Contacts/Staff'))
      await view.events.click(view.getByRole('button', { name: 'Load fields' }))
      await vi.waitFor(() => expect(view.getAllByLabelText('Exchange field')).toHaveLength(4))

      await view.events.click(view.getByRole('button', { name: 'Try it (changes nothing)' }))
      await vi.advanceTimersByTimeAsync(4500)
      await vi.waitFor(() => expect(view.getByRole('region', { name: '4. Try and save' })).toHaveTextContent('10 created'))

      await view.events.click(view.getByRole('button', { name: 'Save' }))
      await vi.waitFor(() => expect(calls.some((call) => call.method === 'PUT')).toBe(true))
      expect(calls.find((call) => call.method === 'PUT')?.body).toEqual({
        config: {
          auth_type: 'oauth',
          endpoint: 'https://outlook.office365.com/EWS/Exchange.asmx',
          disable_ssl_verify: false,
          folders: ['AAMk2'],
          attributes: {
            given_name: 'firstname',
            surname: 'lastname',
            'email_addresses.emailaddress1': 'email',
            'phone_numbers.businessphone': 'phone',
          },
        },
      })
      expect(calls.find((call) => call.url === '/api/v1/integration/exchange/folders')?.body).not.toHaveProperty('password')
      vi.useRealTimers()
    })

    it('saves the Microsoft 365 app after Microsoft accepts it', async () => {
      const calls = mockServer({
        'GET /api/v1/studenthub/integrations/exchange': () => ({ body: { ...exchangeSettings, app: null, account: null } }),
        'GET /api/v1/integration/exchange/job_start': () => ({ body: {} }),
        'POST /api/v1/external_credentials/exchange/app_verify': () => ({
          body: { attributes: { client_id: 'abc-123', client_secret: 's3cret', client_tenant: 'tenant-1' } },
        }),
        'POST /api/v1/external_credentials': () => ({ status: 201, body: { id: 2 } }),
      })

      const view = await render(Exchange)

      await view.events.type(await view.findByLabelText('Client ID'), 'abc-123')
      await view.events.type(view.getByLabelText('Client secret'), 's3cret')
      await view.events.type(view.getByLabelText('Tenant ID (optional)'), 'tenant-1')
      await view.events.click(view.getByRole('button', { name: 'Save app' }))

      await vi.waitFor(() =>
        expect(calls.find((call) => call.url === '/api/v1/external_credentials')?.body).toEqual({
          name: 'exchange',
          credentials: { client_id: 'abc-123', client_secret: 's3cret', client_tenant: 'tenant-1' },
        }),
      )
    })

    it('explains the outcome of the Microsoft 365 sign-in', () => {
      expect(exchangeResultMessage('success/1')).toMatchObject({ ok: true })
      expect(exchangeResultMessage('error/AADSTS65004')?.text).toBe('Microsoft 365 needs an administrator to consent to the app first.')
      expect(exchangeResultMessage(undefined)).toBeNull()
    })
  })
})
