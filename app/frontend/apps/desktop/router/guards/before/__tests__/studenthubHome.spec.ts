// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { mockPermissions } from '#tests/support/mock-permissions.ts'

import studenthubHome from '../studenthubHome.ts'

import type { RouteLocationNormalized } from 'vue-router'

const route = (path: string) =>
  ({ name: 'Test', path, fullPath: path, meta: {} }) as RouteLocationNormalized

describe('studenthubHome', () => {
  const from = {} as RouteLocationNormalized

  it('sends staff from the home page to the dashboard', () => {
    mockPermissions(['ticket.agent'])

    expect(studenthubHome(route('/'), from, vi.fn())).toEqual({ path: '/dashboard', replace: true })
  })

  it('sends admins to the dashboard too', () => {
    mockPermissions(['admin'])

    expect(studenthubHome(route('/'), from, vi.fn())).toEqual({ path: '/dashboard', replace: true })
  })

  it('keeps students on their ticket list', () => {
    mockPermissions(['ticket.customer'])

    expect(studenthubHome(route('/'), from, vi.fn())).toBe(true)
  })

  it('leaves other pages alone', () => {
    mockPermissions(['ticket.agent'])

    expect(studenthubHome(route('/tickets/view'), from, vi.fn())).toBe(true)
  })
})
