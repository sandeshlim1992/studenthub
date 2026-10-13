// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { test as base, expect, type APIRequestContext } from '@playwright/test'

import { BASE_URL, staffAccount, studentAccount } from './env.ts'
import { confirmBetaNotice } from './session.ts'

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
  state: string
}

// Staff answer over Zammad's REST API with web messages (no email), signed in with their password.
export class StaffApi {
  constructor(private readonly api: APIRequestContext) {}

  private async json<T>(response: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T> {
    await expect(response, await response.text()).toBeOK()
    return (await response.json()) as T
  }

  async ticket(id: number) {
    return this.json<Ticket>(await this.api.get(`/api/v1/tickets/${id}?expand=true`))
  }

  async articles(ticketId: number) {
    return this.json<Article[]>(await this.api.get(`/api/v1/ticket_articles/by_ticket/${ticketId}`))
  }

  async reply(ticketId: number, body: string) {
    return this.addArticle(ticketId, body, false)
  }

  async internalNote(ticketId: number, body: string) {
    return this.addArticle(ticketId, body, true)
  }

  private async addArticle(ticketId: number, body: string, internal: boolean) {
    return this.json<Article>(
      await this.api.post('/api/v1/ticket_articles', {
        data: {
          ticket_id: ticketId,
          body,
          type: internal ? 'note' : 'web',
          internal,
          content_type: 'text/plain',
        },
      }),
    )
  }

  async setState(ticketId: number, state: string) {
    return this.json<Ticket>(await this.api.put(`/api/v1/tickets/${ticketId}`, { data: { state } }))
  }

  // Any ticket that belongs to someone else.
  async ticketOfAnotherCustomer(customerId: number) {
    const tickets = await this.json<Ticket[]>(await this.api.get('/api/v1/tickets?per_page=50'))
    const ticket = tickets.find((candidate) => candidate.customer_id !== customerId)
    if (!ticket) throw new Error('No ticket of another customer found')

    return ticket.id
  }

  async deleteTicket(id: number) {
    await expect(await this.api.delete(`/api/v1/tickets/${id}`)).toBeOK()
  }
}

export const test = base.extend<{ appErrors: string[] }, { staff: StaffApi; studentId: number }>({
  page: async ({ page }, use) => {
    await confirmBetaNotice(page)
    await use(page)
  },

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
      const account = staffAccount()
      const api = await playwright.request.newContext({
        baseURL: BASE_URL,
        httpCredentials: { username: account.login, password: account.password, send: 'always' },
        // Not the student's saved sign-in (the project default): its session would win over the password.
        storageState: { cookies: [], origins: [] },
      })

      await use(new StaffApi(api))
      await api.dispose()
    },
    { scope: 'worker' },
  ],

  // The student's user ID, as the student sees it.
  studentId: [
    async ({ playwright }, use) => {
      const account = studentAccount()
      const api = await playwright.request.newContext({
        baseURL: BASE_URL,
        httpCredentials: { username: account.login, password: account.password, send: 'always' },
        // Not the student's saved sign-in (the project default): its session would win over the password.
        storageState: { cookies: [], origins: [] },
      })
      const response = await api.get('/api/v1/users/me')
      await expect(response, await response.text()).toBeOK()
      const { id } = (await response.json()) as { id: number }
      await api.dispose()

      await use(id)
    },
    { scope: 'worker' },
  ],
})

export { expect }
