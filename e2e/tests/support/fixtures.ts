// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import {
  test as base,
  expect,
  type APIRequestContext,
  type APIResponse,
  type PlaywrightWorkerArgs,
} from '@playwright/test'

import { BASE_URL, staffAccount, studentAccount, type Account } from './env.ts'

interface Article {
  id: number
  sender: string
  type: string
  internal: boolean
  body: string
  attachments: { filename: string }[]
}

interface Ticket {
  id: number
  number: string
  title: string
  customer_id: number
  group_id: number
  state: string
  owner: string
}

// Zammad's REST API, signed in with a password (HTTP basic auth).
class ApiClient {
  constructor(protected readonly api: APIRequestContext) {}

  protected async json<T>(response: APIResponse): Promise<T> {
    await expect(response, await response.text()).toBeOK()
    return (await response.json()) as T
  }

  async ticket(id: number) {
    return this.json<Ticket>(await this.api.get(`/api/v1/tickets/${id}?expand=true`))
  }

  async articles(ticketId: number) {
    return this.json<Article[]>(await this.api.get(`/api/v1/ticket_articles/by_ticket/${ticketId}`))
  }

  protected async addArticle(ticketId: number, data: Record<string, unknown>) {
    return this.json<Article>(
      await this.api.post('/api/v1/ticket_articles', {
        data: { ticket_id: ticketId, content_type: 'text/plain', ...data },
      }),
    )
  }
}

// Staff answer with web messages (no email), move tickets between teams and tidy up.
export class StaffApi extends ApiClient {
  async reply(ticketId: number, body: string) {
    return this.addArticle(ticketId, { body, type: 'web', internal: false })
  }

  async internalNote(ticketId: number, body: string) {
    return this.addArticle(ticketId, { body, type: 'note', internal: true })
  }

  async setState(ticketId: number, state: string) {
    return this.update(ticketId, { state })
  }

  async update(ticketId: number, data: Record<string, unknown>) {
    return this.json<Ticket>(await this.api.put(`/api/v1/tickets/${ticketId}`, { data }))
  }

  async groupId(name: string) {
    const groups = await this.json<{ id: number; name: string }[]>(
      await this.api.get('/api/v1/groups'),
    )
    const group = groups.find((candidate) => candidate.name === name)
    if (!group) throw new Error(`No team ${name}`)

    return group.id
  }

  // Any ticket that belongs to someone else.
  async ticketOfAnotherCustomer(customerId: number) {
    return this.findTicket((ticket) => ticket.customer_id !== customerId)
  }

  // Any ticket of another team.
  async ticketOutsideTeam(groupId: number) {
    return this.findTicket((ticket) => ticket.group_id !== groupId)
  }

  private async findTicket(matches: (ticket: Ticket) => boolean) {
    const tickets = await this.json<Ticket[]>(await this.api.get('/api/v1/tickets?per_page=100'))
    const ticket = tickets.find(matches)
    if (!ticket) throw new Error('No such ticket found')

    return ticket.id
  }

  // Retried: right after a change, background jobs (notifications) can briefly lock the same rows.
  async deleteTicket(id: number) {
    await expect(async () => {
      const response = await this.api.delete(`/api/v1/tickets/${id}`)
      expect([200, 404], await response.text()).toContain(response.status())
    }).toPass({ timeout: 30_000 })
  }
}

// The student raising and answering tickets over the web, for the staff tests.
export class StudentApi extends ApiClient {
  async me() {
    return this.json<{ id: number; login: string }>(await this.api.get('/api/v1/users/me'))
  }

  async createTicket(ticket: {
    title: string
    body: string
    groupId: number
    fields: Record<string, string>
  }) {
    return this.json<Ticket>(
      await this.api.post('/api/v1/tickets', {
        data: {
          title: ticket.title,
          group_id: ticket.groupId,
          ...ticket.fields,
          article: { body: ticket.body, type: 'web', content_type: 'text/plain' },
        },
      }),
    )
  }

  async reply(ticketId: number, body: string) {
    return this.addArticle(ticketId, { body, type: 'web', internal: false })
  }
}

const apiContext = (playwright: PlaywrightWorkerArgs['playwright'], account: Account) =>
  playwright.request.newContext({
    baseURL: BASE_URL,
    httpCredentials: { username: account.login, password: account.password, send: 'always' },
    // Not the project's saved browser sign-in: its session would win over the password.
    storageState: { cookies: [], origins: [] },
  })

export const test = base.extend<
  { appErrors: string[] },
  { staff: StaffApi; student: StudentApi; studentId: number }
>({
  // Console errors and warnings, uncaught errors and failed requests to the app, per test.
  appErrors: [
    async ({ page }, use) => {
      const errors: string[] = []

      page.on('console', (message) => {
        if (['error', 'warning'].includes(message.type()))
          errors.push(`console ${message.type()}: ${message.text()}`)
      })
      page.on('pageerror', (error) => errors.push(`page error: ${error.message}`))
      page.on('response', (response) => {
        if (response.status() >= 400 && response.url().startsWith(BASE_URL))
          errors.push(`${response.status()} ${response.request().method()} ${response.url()}`)
      })

      await use(errors)
    },
    { auto: true },
  ],

  staff: [
    async ({ playwright }, use) => {
      const api = await apiContext(playwright, staffAccount())
      await use(new StaffApi(api))
      await api.dispose()
    },
    { scope: 'worker' },
  ],

  student: [
    async ({ playwright }, use) => {
      const api = await apiContext(playwright, studentAccount())
      await use(new StudentApi(api))
      await api.dispose()
    },
    { scope: 'worker' },
  ],

  // The student's user ID, as the student sees it.
  studentId: [
    async ({ student }, use) => {
      await use((await student.me()).id)
    },
    { scope: 'worker' },
  ],
})

export { expect }
