// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { AGENT_STATE, STUDENT_STATE, agentAccount, studentAccount } from './support/env.ts'
import { expect, test as setup } from './support/fixtures.ts'
import { signIn } from './support/session.ts'

// Signs each role in once; their tests reuse the saved sign-in.
setup('sign in as the student', async ({ page }) => {
  await signIn(page, studentAccount())
  await expect(page).toHaveURL(/\/tickets\/view\/my_tickets/)

  await page.context().storageState({ path: STUDENT_STATE })
})

setup('sign in as the agent', async ({ page }) => {
  await signIn(page, agentAccount())
  await expect(page).toHaveURL(/\/dashboard/)

  await page.context().storageState({ path: AGENT_STATE })
})
