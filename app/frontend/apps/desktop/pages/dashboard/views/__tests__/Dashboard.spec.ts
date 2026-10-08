// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { renderComponent } from '#tests/support/components/index.ts'
import { mockUserCurrent } from '#tests/support/mock-userCurrent.ts'
import { mockRouterHooks } from '#tests/support/mock-vue-router.ts'

import { convertToGraphQLId } from '#shared/graphql/utils.ts'

import Dashboard from '../Dashboard.vue'

vi.mock('#desktop/pages/dashboard/components/StudenthubAdminDashboard.vue', async () => {
  const { h } = await import('vue')
  return { default: { render: () => h('p', 'Team overview dashboard') } }
})

vi.mock('#desktop/pages/dashboard/components/StudenthubAgentDashboard.vue', async () => {
  const { h } = await import('vue')
  return { default: { render: () => h('p', 'Briefing dashboard') } }
})

vi.mock('#desktop/pages/dashboard/components/StudenthubManagerDashboard.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent(
      (_props, { slots }) =>
        () =>
          h('div', [slots.top?.(), h('p', 'Approvals dashboard')]),
    ),
  }
})

mockRouterHooks()

// The approval viewer is asked once per user, so every test signs in someone else.
let nextUserId = 100

const signIn = (permissions: string[], managerOnly = false) => {
  nextUserId += 1
  mockUserCurrent({
    id: convertToGraphQLId('User', nextUserId),
    internalId: nextUserId,
    permissions: { names: permissions },
  })

  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ enabled: true, manager_only: managerOnly }, { status: 200 })),
  )
}

const renderDashboard = () => renderComponent(Dashboard, { router: true, store: true })

describe('Dashboard', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('gives admins who are also agents and managers three dashboards', async () => {
    signIn(['admin', 'ticket.agent', 'ticket.approver'])

    const view = renderDashboard()

    const switcher = await view.findByRole('group', { name: 'Dashboard view' })
    expect(
      Array.from(switcher.querySelectorAll('button')).map((button) => button.textContent?.trim()),
    ).toEqual(['Team overview', 'My work', 'Approvals'])
    expect(view.getByRole('button', { name: 'Team overview' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(view.getByText('Team overview dashboard')).toBeInTheDocument()

    await view.events.click(view.getByRole('button', { name: 'Approvals' }))

    expect(await view.findByText('Approvals dashboard')).toBeInTheDocument()
    expect(view.getByRole('button', { name: 'Approvals' })).toHaveAttribute('aria-pressed', 'true')
    expect(localStorage.getItem('studenthub-dashboard-view')).toBe('approvals')

    await view.events.click(view.getByRole('button', { name: 'My work' }))

    expect(await view.findByText('Briefing dashboard')).toBeInTheDocument()
  })

  it('gives agents who are managers their briefing and their approvals', async () => {
    signIn(['ticket.agent', 'ticket.approver'])

    const view = renderDashboard()

    const switcher = await view.findByRole('group', { name: 'Dashboard view' })
    expect(
      Array.from(switcher.querySelectorAll('button')).map((button) => button.textContent?.trim()),
    ).toEqual(['My work', 'Approvals'])
    expect(view.getByText('Briefing dashboard')).toBeInTheDocument()
  })

  it('gives managers without another staff role only their approvals', async () => {
    // The Managers role carries ticket.agent.
    signIn(['ticket.agent', 'ticket.approver'], true)

    const view = renderDashboard()

    expect(await view.findByText('Approvals dashboard')).toBeInTheDocument()
    expect(view.queryByRole('group', { name: 'Dashboard view' })).not.toBeInTheDocument()
  })

  it('gives agents only their briefing', async () => {
    signIn(['ticket.agent'])

    const view = renderDashboard()

    expect(await view.findByText('Briefing dashboard')).toBeInTheDocument()
    expect(view.queryByRole('group', { name: 'Dashboard view' })).not.toBeInTheDocument()
  })

  it('opens the dashboard chosen last time', async () => {
    localStorage.setItem('studenthub-dashboard-view', 'approvals')
    signIn(['admin', 'ticket.agent', 'ticket.approver'])

    const view = renderDashboard()

    expect(await view.findByText('Approvals dashboard')).toBeInTheDocument()
    expect(view.getByRole('button', { name: 'Approvals' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('opens the first dashboard when the one chosen last time is no longer available', async () => {
    localStorage.setItem('studenthub-dashboard-view', 'approvals')
    signIn(['admin', 'ticket.agent'])

    const view = renderDashboard()

    expect(await view.findByText('Team overview dashboard')).toBeInTheDocument()
    expect(view.queryByText('Approvals dashboard')).not.toBeInTheDocument()
  })
})
