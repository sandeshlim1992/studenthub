// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import type { Locator, Page } from '@playwright/test'

import { agentAccount } from './support/env.ts'
import { expect, test } from './support/fixtures.ts'
import { signIn } from './support/session.ts'

// An agent handles a student's ticket on the web: finds it in their team, replies, adds an
// internal note, takes it and waits for the student, sees the student's answer and closes it;
// plus what an agent must not see. The student works through the API (support/fixtures.ts).
// Everything is a web message: no email is involved.

// Values from the Student Hub data.
const TEAM = 'Service Desk' // the agent's team (role "Agent : Service Desk")
const NEW_TICKETS_TEAM = 'Unassigned Tickets' // where students' tickets land
const TICKET_FIELDS = { category2: 'Software', subcategory: 'Web Browsers', campus: 'LSST Wembley' }
const AWAITING_STUDENT_STATE = '4. Awaiting user Response'
const CLOSED_STATE = '6. Closed'

const RUN = Date.now()
const TITLE = `[TEST] Playwright agent journey ${RUN}`
const STUDENT_MESSAGE =
  'My browser shows a blank page on the LSST Portal. (Browser test, safe to delete.)'
const AGENT_REPLY = `Agent reply ${RUN}: please try a private window and tell us if it loads.`
const INTERNAL_NOTE = `Internal note ${RUN}: checked the portal status, it is up.`
const STUDENT_REPLY = `Student reply ${RUN}: it loads in a private window.`

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// "Team Service Desk" and the like in the Ticket panel's details.
const expectField = async (panel: Locator, label: string, value: string) =>
  expect(panel).toContainText(new RegExp(`${escape(label)}\\s*${escape(value)}`))

// Opens the reply box in the given mode and types into its editor.
const write = async (page: Page, placeholder: RegExp, text: string) => {
  await page.getByRole('textbox', { name: placeholder }).click()
  const box = page.getByRole('complementary', { name: 'Reply' })
  await box.locator('[contenteditable="true"][id^="body-"]').click()
  await page.keyboard.type(text)

  return box
}

test.describe('A student ticket handled by an agent on the web', () => {
  test.describe.configure({ mode: 'serial' })

  let ticketId: number
  let ticketNumber: string

  // The student raises it on the web; staff move it from the new tickets to the agent's team.
  test.beforeAll(async ({ staff, student }) => {
    const ticket = await student.createTicket({
      title: TITLE,
      body: STUDENT_MESSAGE,
      groupId: await staff.groupId(NEW_TICKETS_TEAM),
      fields: TICKET_FIELDS,
    })
    ticketId = ticket.id
    ticketNumber = ticket.number

    await staff.update(ticketId, { group_id: await staff.groupId(TEAM) })
  })

  test.afterAll(async ({ staff }) => {
    if (ticketId) await staff.deleteTicket(ticketId)
  })

  test('the agent lands on their Dashboard briefing', async ({ page, appErrors }) => {
    await page.goto('/')

    await expect(page).toHaveURL(/\/dashboard/)
    await expect(
      page.getByRole('complementary', { name: 'Dashboard' }).getByText(/^agent$/i),
    ).toBeVisible()

    const rail = page.getByRole('navigation', { name: 'Navigation' })
    for (const item of ['Dashboard', 'Tickets', 'KB', 'Members'])
      await expect(rail.getByRole('link', { name: item, exact: true })).toBeVisible()
    for (const item of ['Admin', 'Reports'])
      await expect(rail.getByRole('link', { name: item, exact: true })).toHaveCount(0)

    for (const section of ['Waiting time today', 'Escalations', 'Your workload', 'Activity'])
      await expect(page.getByRole('region', { name: section })).toBeVisible()
    await expect(
      page
        .getByRole('region', { name: 'Unassigned in your teams' })
        .getByRole('region', { name: TEAM }),
    ).toBeVisible()

    expect(appErrors).toEqual([])
  })

  test('finds the ticket in their team and opens it beside the queue', async ({
    page,
    appErrors,
  }) => {
    await page.goto('/tickets/view')
    await page
      .getByRole('navigation', { name: 'Team views' })
      .getByRole('link', { name: new RegExp(`^${escape(TEAM)}`) })
      .click()
    await expect(page.getByRole('main').getByRole('heading', { name: TEAM })).toBeVisible()

    await page.getByRole('main').getByText(TITLE).click()
    await expect(page).toHaveURL(new RegExp(`/tickets/${ticketId}$`))

    await expect(
      page
        .getByRole('complementary', { name: 'Ticket queue' })
        .getByRole('link', { name: new RegExp(`#${ticketNumber}`) }),
    ).toBeVisible()

    const panels = page.getByRole('navigation', { name: 'Ticket panels' })
    for (const tab of ['Ticket', 'Student', 'Checklist'])
      await expect(panels.getByRole('button', { name: tab, exact: true })).toBeVisible()

    const sidebar = page.getByRole('complementary', { name: 'Content sidebar' })
    await expectField(sidebar, 'Team', TEAM)
    await expectField(
      sidebar,
      'Category',
      `${TICKET_FIELDS.category2} › ${TICKET_FIELDS.subcategory}`,
    )
    await expectField(sidebar, 'Campus', TICKET_FIELDS.campus)
    await expect(page.getByText(STUDENT_MESSAGE)).toBeVisible()

    expect(appErrors).toEqual([])
  })

  test('replies to the student over the web', async ({ page, appErrors, staff, student }) => {
    await page.goto(`/tickets/${ticketId}`)

    const replyBox = await write(page, /^Write a reply to/, AGENT_REPLY)
    await expect(replyBox.getByRole('radio', { name: 'Web' })).toBeChecked()
    await replyBox.getByRole('button', { name: 'Send', exact: true }).click()

    await expect(replyBox).toBeHidden()
    await expect(page.getByText(AGENT_REPLY)).toBeVisible()

    await expect
      .poll(async () => (await staff.articles(ticketId)).at(-1))
      .toMatchObject({ sender: 'Agent', type: 'web', internal: false })
    expect((await staff.articles(ticketId)).at(-1)?.body).toContain(AGENT_REPLY)

    // The student gets it.
    expect((await student.articles(ticketId)).map((article) => article.body).join('\n')).toContain(
      AGENT_REPLY,
    )

    expect(appErrors).toEqual([])
  })

  test('adds an internal note the student never sees', async ({
    page,
    appErrors,
    staff,
    student,
  }) => {
    await page.goto(`/tickets/${ticketId}`)

    await page.getByRole('tab', { name: 'Internal note' }).click()
    const noteBox = await write(page, /^Write an internal note/, INTERNAL_NOTE)
    await expect(noteBox.getByRole('tab', { name: 'Internal note' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await noteBox.getByRole('button', { name: 'Add note' }).click()

    await expect(noteBox).toBeHidden()
    await expect(page.getByText(INTERNAL_NOTE)).toBeVisible()

    await expect
      .poll(async () => (await staff.articles(ticketId)).at(-1))
      .toMatchObject({ internal: true })
    expect(
      (await student.articles(ticketId)).map((article) => article.body).join('\n'),
    ).not.toContain(INTERNAL_NOTE)

    expect(appErrors).toEqual([])
  })

  test('takes the ticket and waits for the student', async ({ page, appErrors, staff }) => {
    await page.goto(`/tickets/${ticketId}`)
    const actions = page.getByRole('toolbar', { name: 'Ticket header actions' })

    await actions.getByRole('button', { name: 'Assign' }).click()
    await page.getByRole('menuitem', { name: 'Assign to me' }).click()
    await actions.getByRole('button', { name: 'Change status' }).click()
    await page.getByRole('menuitem', { name: AWAITING_STUDENT_STATE }).click()
    await page
      .getByRole('region', { name: 'Save changes' })
      .getByRole('button', { name: 'Update' })
      .click()

    await expect
      .poll(async () => {
        const ticket = await staff.ticket(ticketId)
        return [ticket.state, ticket.owner]
      })
      .toEqual([AWAITING_STUDENT_STATE, agentAccount().login])

    expect(appErrors).toEqual([])
  })

  test("sees the student's answer arrive", async ({ page, appErrors, staff, student }) => {
    await page.goto(`/tickets/${ticketId}`)
    await expect(page.getByText(AGENT_REPLY)).toBeVisible()

    await student.reply(ticketId, STUDENT_REPLY)

    // Without reloading; the answer hands the ticket back to staff.
    await expect(page.getByText(STUDENT_REPLY)).toBeVisible()
    await expect
      .poll(async () => (await staff.ticket(ticketId)).state)
      .not.toBe(AWAITING_STUDENT_STATE)

    expect(appErrors).toEqual([])
  })

  test('closes the ticket', async ({ page, appErrors, staff }) => {
    await page.goto(`/tickets/${ticketId}`)

    await page
      .getByRole('toolbar', { name: 'Ticket header actions' })
      .getByRole('button', { name: 'Close', exact: true })
      .click()

    await expect.poll(async () => (await staff.ticket(ticketId)).state).toBe(CLOSED_STATE)

    expect(appErrors).toEqual([])
  })
})

test.describe('What an agent must not see', () => {
  test("another team's ticket", async ({ page, staff }) => {
    const otherTicketId = await staff.ticketOutsideTeam(await staff.groupId(TEAM))

    await page.goto(`/tickets/${otherTicketId}`)

    await expect(page.getByText('You have insufficient rights to view this ticket.')).toBeVisible()
  })

  // Wait until the page shows something (refused or not) before checking what it is.
  for (const [name, path, heading] of [
    ['Administration', '/manage', 'Administration'],
    ['Reports', '/report', 'Reporting'],
  ]) {
    test(name, async ({ page }) => {
      await page.goto(path)

      const refused = page.getByText("This page doesn't exist.")
      const shown = page.getByRole('heading', { name: heading })
      await expect(refused.or(shown).first()).toBeVisible()
      await expect(shown).toBeHidden()
    })
  }
})

test('Members shows who is online', async ({ page, appErrors }) => {
  await page.goto('/members')

  await expect(
    page.getByRole('main').getByRole('heading', { name: 'Members', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: /^Online now/ })).toBeVisible()

  expect(appErrors).toEqual([])
})

// From the Dashboard to a ticket, then to the ticket list, moving within the app: the ticket and
// the Dashboard stay open in the background.
const openTicketThenList = async (page: Page) => {
  await page.getByRole('region', { name: 'Activity' }).getByRole('link').first().click()
  await expect(page).toHaveURL(/\/tickets\/\d+/)
  await expect(page.getByRole('region', { name: 'Save changes' })).toBeVisible()

  await page
    .getByRole('navigation', { name: 'Navigation' })
    .getByRole('link', { name: 'Tickets', exact: true })
    .click()
  await expect(page).toHaveURL(/\/tickets\/view/)
  // Errors from the pages left behind arrive a moment later.
  await page.waitForTimeout(2_000)
}

test('leaving a ticket for the ticket list leaves no errors', async ({ page, appErrors }) => {
  await page.goto('/dashboard')

  await openTicketThenList(page)

  expect(appErrors).toEqual([])
})

test.describe('Signing out', () => {
  // Its own sign-in, so the saved one stays valid.
  test.use({ storageState: { cookies: [], origins: [] } })

  test('with pages open in the background leaves no errors', async ({ page, appErrors }) => {
    await signIn(page, agentAccount())
    await expect(page).toHaveURL(/\/dashboard/)
    await openTicketThenList(page)
    // Only what signing out causes (leaving the ticket is the test above).
    appErrors.length = 0

    await page.getByRole('banner').getByRole('button', { expanded: false }).last().click()
    await page.getByText('Sign out', { exact: true }).click()

    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
    // Errors from pages reacting to the sign-out arrive a moment later.
    await page.waitForTimeout(2_000)
    expect(appErrors).toEqual([])
  })
})
