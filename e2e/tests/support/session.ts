// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { expect, type Page } from '@playwright/test'

import type { Account } from './env.ts'

// The "New desktop BETA UI" notice can open over any page; confirm it whenever it shows.
export const confirmBetaNotice = async (page: Page) => {
  await page.addLocatorHandler(
    page.getByRole('heading', { name: 'New desktop BETA UI' }),
    async () => {
      await page.getByRole('button', { name: 'Confirm' }).click()
    },
  )
}

// Signs in with the local login form (under "Admin / Local Login"). The page fixture confirms
// the BETA UI notice (support/fixtures.ts).
export const signIn = async (page: Page, account: Account) => {
  await page.goto('/login')

  // The first sign-in in a fresh browser can fail the security token check; the page then
  // reloads, after which it works.
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const localLogin = page.getByRole('button', { name: 'Admin / Local Login' })
    if ((await localLogin.getAttribute('aria-expanded')) !== 'true') await localLogin.click()

    await page.getByRole('textbox', { name: 'Username / Email' }).fill(account.login)
    await page.getByRole('textbox', { name: 'Password' }).fill(account.password)
    await page.getByRole('button', { name: 'Sign in' }).click()

    // Checked without waiting, so no wait outlives the sign-in: a leftover one ran the BETA notice
    // handler at the same time as the test's next step, which then hung.
    const tokenFailed = page.getByText('Security token verification failed')
    let outcome: 'signed-in' | 'token-failed' | undefined
    await expect(async () => {
      if (!new URL(page.url()).pathname.startsWith('/login')) outcome = 'signed-in'
      else if (await tokenFailed.isVisible()) outcome = 'token-failed'
      expect(outcome).toBeDefined()
    })
      .toPass({ timeout: 20_000 })
      .catch(() => undefined)

    if (outcome === 'signed-in') return
    if (!outcome) break

    await page.reload()
  }

  throw new Error(`Signing in as ${account.login} failed.`)
}
