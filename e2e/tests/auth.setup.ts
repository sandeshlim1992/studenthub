// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { STUDENT_STATE, studentAccount } from './support/env.ts'
import { expect, test as setup } from './support/fixtures.ts'
import { signIn } from './support/session.ts'

// Signs the student in once; the student tests reuse the saved sign-in.
setup('sign in as the student', async ({ page }) => {
  await signIn(page, studentAccount())
  await expect(page).toHaveURL(/\/tickets\/view\/my_tickets/)

  await page.context().storageState({ path: STUDENT_STATE })
})
