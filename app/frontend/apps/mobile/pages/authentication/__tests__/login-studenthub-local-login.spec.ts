// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { visitView } from '#tests/support/components/visitView.ts'
import { mockApplicationConfig } from '#tests/support/mock-applicationConfig.ts'

import {
  mockPublicLinks,
  mockPublicLinksSubscription,
} from '#shared/entities/public-links/__tests__/mocks/mockPublicLinks.ts'

// Student Hub: third-party sign-in first, the username and password form behind "Admin / local login".
describe('Student Hub local login on the sign-in page', () => {
  beforeEach(() => {
    mockPublicLinks([])
    mockPublicLinksSubscription()
  })

  it('keeps the username and password closed until "Admin / local login" is opened', async () => {
    mockApplicationConfig({ user_show_password_login: true, auth_microsoft_office365: true })

    const view = await visitView('/login')

    const microsoft = view.getByRole('button', { name: 'Sign in with Microsoft' })
    const localLogin = view.getByRole('button', { name: 'Admin / local login' })

    expect(microsoft.compareDocumentPosition(localLogin)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(view.getByText('or')).toBeInTheDocument()
    expect(localLogin).toHaveAttribute('aria-expanded', 'false')
    expect(view.queryByLabelText('Username / Email')).not.toBeInTheDocument()

    await view.events.click(localLogin)

    expect(localLogin).toHaveAttribute('aria-expanded', 'true')
    expect(view.getByLabelText('Username / Email')).toBeInTheDocument()
    expect(view.getByLabelText('Password')).toBeInTheDocument()

    await view.events.click(localLogin)

    expect(view.queryByLabelText('Username / Email')).not.toBeInTheDocument()
  })

  it('shows the form straight away when no third-party sign-in is switched on', async () => {
    mockApplicationConfig({ user_show_password_login: true, auth_microsoft_office365: false })

    const view = await visitView('/login')

    expect(view.queryByRole('button', { name: 'Admin / local login' })).not.toBeInTheDocument()
    expect(view.getByLabelText('Username / Email')).toBeInTheDocument()
  })
})
