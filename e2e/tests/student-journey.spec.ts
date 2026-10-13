// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import path from 'node:path'

import type { Locator, Page } from '@playwright/test'

import { studentAccount } from './support/env.ts'
import { expect, test } from './support/fixtures.ts'
import { signIn } from './support/session.ts'

// A student raises a ticket on the web portal, follows it while staff answer over the web, replies
// and closes it; plus what a student must not see. Staff work through the API (support/fixtures.ts).
// Everything is a web message: no email is involved.

// Values from the Student Hub data (Objects → Category / Sub-Category / Campus, ticket states).
const CATEGORY = 'Software'
const SUB_CATEGORY = 'Web Browsers'
const CAMPUS = 'LSST Wembley'
const AWAITING_STUDENT_STATE = '4. Awaiting user Response'
const CLOSED_STATE = '6. Closed'

// The main button on the student's home page (a smaller one without the arrow sits beside the list).
const RAISE_TICKET = 'Raise a New Ticket →'

const RUN = Date.now()
const TITLE = `[TEST] Playwright student journey ${RUN}`
const DESCRIPTION = 'The LSST Portal does not load in my browser. (Browser test, safe to delete.)'
const STAFF_REPLY = `Staff reply ${RUN}: please clear your browser cache and try again.`
const INTERNAL_NOTE = `Internal note ${RUN}: staff only, the student must never see this.`
const STUDENT_REPLY = `Student reply ${RUN}: clearing the cache fixed it, thank you.`
const ATTACHMENT = path.join(__dirname, '../fixtures/test-note.txt')

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// "Status Received" and the like in the sidebar's Your request section.
const expectField = async (sidebar: Locator, label: string, value: string) =>
  expect(sidebar).toContainText(new RegExp(`${escape(label)}\\s*${escape(value)}`))

const sidebarOf = (page: Page) => page.getByRole('complementary', { name: 'Content sidebar' })

const chooseOption = async (page: Page, field: string, option: string) => {
  const combobox = page.getByRole('combobox', { name: field, exact: true })

  await combobox.click()
  await page.getByRole('option', { name: option, exact: true }).click()
  await expect(combobox).toContainText(option)
}

test.describe('A ticket raised and followed on the web portal', () => {
  test.describe.configure({ mode: 'serial' })

  let ticketId: number

  test.afterAll(async ({ staff }) => {
    if (ticketId) await staff.deleteTicket(ticketId)
  })

  test('the student lands on their own ticket list', async ({ page, appErrors }) => {
    await page.goto('/')

    await expect(page).toHaveURL(/\/tickets\/view\/my_tickets/)
    await expect(page.getByRole('heading', { name: 'My Tickets' })).toBeVisible()
    await expect(page.getByRole('button', { name: RAISE_TICKET, exact: true })).toBeVisible()
    expect(appErrors).toEqual([])
  })

  test('raises a ticket with a file', async ({ page, appErrors, staff, studentId }) => {
    await page.goto('/')
    await page.getByRole('button', { name: RAISE_TICKET, exact: true }).click()

    await expect(page).toHaveURL(/\/tickets\/create\/.*mode=form/)
    await expect(page.getByRole('heading', { name: 'Submit a Support Request' })).toBeVisible()

    await page.getByRole('textbox', { name: 'Title' }).fill(TITLE)
    // The message editor (the ticket's body field).
    await page.locator('[contenteditable="true"][id^="body-"]').click()
    await page.keyboard.type(DESCRIPTION)
    await chooseOption(page, 'Category', CATEGORY)
    await chooseOption(page, 'Sub-Category', SUB_CATEGORY)
    await chooseOption(page, 'Campus', CAMPUS)

    const fileChooser = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'Attach files' }).click()
    await (await fileChooser).setFiles(ATTACHMENT)
    await expect(page.getByRole('img', { name: /is uploading/ })).toHaveCount(0)

    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await page.waitForURL(/\/tickets\/\d+$/)
    ticketId = Number(new URL(page.url()).pathname.split('/').at(-1))

    // What staff get: the student's web message with the file.
    const ticket = await staff.ticket(ticketId)
    expect(ticket.title).toBe(TITLE)
    expect(ticket.customer_id).toBe(studentId)

    const [message] = await staff.articles(ticketId)
    expect(message).toMatchObject({ sender: 'Customer', type: 'web', internal: false })
    expect(message.body).toContain(DESCRIPTION)
    expect(message.attachments.map((file) => file.filename)).toContain('test-note.txt')

    expect(appErrors).toEqual([])
  })

  test('sees the request, its progress and the file', async ({ page, appErrors, staff }) => {
    const { number } = await staff.ticket(ticketId)
    await page.goto(`/tickets/${ticketId}`)

    const sidebar = sidebarOf(page)
    await expectField(sidebar, 'Reference', `#${number}`)
    await expectField(sidebar, 'Status', 'Received')
    await expectField(sidebar, 'Category', `${CATEGORY} › ${SUB_CATEGORY}`)
    await expectField(sidebar, 'Campus', CAMPUS)
    await expectField(sidebar, 'Last reply from us', 'No reply yet')
    await expect(sidebar.getByRole('status')).toContainText('We have your request')

    const download = page.waitForEvent('download')
    await sidebar.getByRole('link', { name: 'test-note.txt' }).click()
    expect((await download).suggestedFilename()).toBe('test-note.txt')

    expect(appErrors).toEqual([])
  })

  test('gets the staff reply, but never the internal note', async ({ page, appErrors, staff }) => {
    await page.goto(`/tickets/${ticketId}`)
    const sidebar = sidebarOf(page)
    await expectField(sidebar, 'Status', 'Received')

    await staff.reply(ticketId, STAFF_REPLY)
    await staff.internalNote(ticketId, INTERNAL_NOTE)
    await staff.setState(ticketId, AWAITING_STUDENT_STATE)

    // Arrives without reloading.
    await expect(page.getByText(STAFF_REPLY)).toBeVisible()
    await expectField(sidebar, 'Status', 'Waiting for you')
    await expect(sidebar.getByRole('status')).toContainText('We have asked you something')
    await expect(sidebar.getByRole('button', { name: 'Reply', exact: true })).toBeVisible()
    await expect(sidebar).not.toContainText(/Last reply from us\s*No reply yet/)

    await page.reload()
    await expect(page.getByText(STAFF_REPLY)).toBeVisible()
    await expect(page.getByText(INTERNAL_NOTE)).toHaveCount(0)

    expect(appErrors).toEqual([])
  })

  test('replies on the web portal', async ({ page, appErrors, staff }) => {
    await page.goto(`/tickets/${ticketId}`)

    await page.getByRole('textbox', { name: 'Write your reply…' }).click()
    const replyBox = page.getByRole('complementary', { name: 'Reply' })
    await expect(replyBox).toBeVisible()
    await page.keyboard.type(STUDENT_REPLY)
    await replyBox.getByRole('button', { name: 'Send' }).click()

    await expect(replyBox).toBeHidden()
    await expect(page.getByText(STUDENT_REPLY)).toBeVisible()

    await expect
      .poll(async () => (await staff.articles(ticketId)).at(-1))
      .toMatchObject({ sender: 'Customer', type: 'web', internal: false })
    expect((await staff.articles(ticketId)).at(-1)?.body).toContain(STUDENT_REPLY)

    // A reply from the student hands the ticket back to staff.
    await expect
      .poll(async () => (await staff.ticket(ticketId)).state)
      .not.toBe(AWAITING_STUDENT_STATE)

    expect(appErrors).toEqual([])
  })

  test('closes the request when they no longer need help', async ({ page, appErrors, staff }) => {
    await page.goto(`/tickets/${ticketId}`)
    const sidebar = sidebarOf(page)

    await sidebar.getByRole('button', { name: 'I no longer need help' }).click()
    await expect(page.getByRole('heading', { name: 'Close this request?' })).toBeVisible()
    await page.getByRole('button', { name: 'Close request' }).click()

    await expect(page.getByText('Your request is closed.')).toBeVisible()
    await expectField(sidebar, 'Status', 'Closed')
    await expect(sidebar.getByRole('button', { name: 'Still not fixed? Reopen' })).toBeVisible()
    await expect.poll(async () => (await staff.ticket(ticketId)).state).toBe(CLOSED_STATE)

    expect(appErrors).toEqual([])
  })
})

test.describe('What a student must not see', () => {
  test("another student's ticket", async ({ page, staff, studentId }) => {
    const otherTicketId = await staff.ticketOfAnotherCustomer(studentId)

    await page.goto(`/tickets/${otherTicketId}`)

    await expect(page.getByText('You have insufficient rights to view this ticket.')).toBeVisible()
  })

  // Wait until the page shows something (refused or not) before checking what it is.
  test('the staff Dashboard', async ({ page }) => {
    await page.goto('/dashboard')

    const refused = page.getByText("This page doesn't exist.")
    const dashboard = page.getByRole('heading', { name: 'Dashboard' })
    await expect(refused.or(dashboard).first()).toBeVisible()
    await expect(dashboard).toBeHidden()
  })

  test('Administration', async ({ page }) => {
    await page.goto('/manage')

    const refused = page.getByText("This page doesn't exist.")
    const administration = page.getByRole('heading', { name: 'Administration' })
    await expect(refused.or(administration).first()).toBeVisible()
    await expect(administration).toBeHidden()
  })
})

test('the home page fits a phone screen', async ({ page, appErrors }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  await expect(page.getByRole('button', { name: RAISE_TICKET, exact: true })).toBeInViewport()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, 'the page scrolls sideways').toBeLessThanOrEqual(0)

  await testInfo.attach('home on a phone', {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
  expect(appErrors).toEqual([])
})

test.describe('Signing out', () => {
  // Its own sign-in, so the saved one stays valid.
  test.use({ storageState: { cookies: [], origins: [] } })

  test('leaves the student on the login page without errors', async ({ page, appErrors }) => {
    await signIn(page, studentAccount())
    await expect(page).toHaveURL(/\/tickets\/view\/my_tickets/)
    appErrors.length = 0

    await page.getByRole('banner').getByRole('button', { expanded: false }).click()
    await page.getByRole('menuitem', { name: 'Sign out' }).click()

    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
    // Errors from pages reacting to the sign-out arrive a moment later.
    await page.waitForTimeout(2_000)
    expect(appErrors).toEqual([])
  })
})
