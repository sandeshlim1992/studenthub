// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import type { Page } from '@playwright/test'

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

    const outcome = await Promise.race([
      page
        .waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 })
        .then(() => 'signed-in' as const)
        .catch(() => 'timeout' as const),
      page
        .getByText('Security token verification failed')
        .waitFor({ timeout: 20_000 })
        .then(() => 'token-failed' as const)
        .catch(() => 'timeout' as const),
    ])

    if (outcome === 'signed-in') return
    if (outcome === 'timeout') break

    await page.reload()
  }

  throw new Error(`Signing in as ${account.login} failed.`)
}
