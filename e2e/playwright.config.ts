// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { defineConfig } from '@playwright/test'

import { BASE_URL, STUDENT_STATE } from './tests/support/env.ts'

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  // One ticket goes through the steps in order, against a shared dev database.
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: './playwright-report' }]],
  use: {
    baseURL: BASE_URL,
    // The Google Chrome installed in the dev container; no browser download needed.
    channel: 'chrome',
    viewport: { width: 1440, height: 900 },
    testIdAttribute: 'data-test-id',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'student',
      dependencies: ['setup'],
      testMatch: /student-.*\.spec\.ts/,
      use: { storageState: STUDENT_STATE },
    },
  ],
})
