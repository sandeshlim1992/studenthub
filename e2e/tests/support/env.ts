// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { existsSync } from 'node:fs'
import path from 'node:path'

// Logins come from e2e/.env (git-ignored, see .env.example) or from the environment.
const envFile = path.join(__dirname, '../../.env')
if (existsSync(envFile)) process.loadEnvFile(envFile)

export const BASE_URL = process.env.STUDENTHUB_BASE_URL || 'http://localhost:3000'

// The student's saved sign-in (cookies), written by auth.setup.ts; git-ignored.
export const STUDENT_STATE = path.join(__dirname, '../../.auth/student.json')

export interface Account {
  login: string
  password: string
}

const password = (variable: string) => {
  const value = process.env[variable]
  if (!value)
    throw new Error(`${variable} is not set: copy e2e/.env.example to e2e/.env and fill it in.`)

  return value
}

export const studentAccount = (): Account => ({
  login: process.env.STUDENTHUB_STUDENT_LOGIN || 'student@example.com',
  password: password('STUDENTHUB_STUDENT_PASSWORD'),
})

export const staffAccount = (): Account => ({
  login: process.env.STUDENTHUB_STAFF_LOGIN || 'admin@example.com',
  password: password('STUDENTHUB_STAFF_PASSWORD'),
})
