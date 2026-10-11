// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { visitView } from '#tests/support/components/visitView.ts'
import { mockApplicationConfig } from '#tests/support/mock-applicationConfig.ts'
import '#tests/graphql/builders/mocks.ts'

describe('Student Hub sign-in page texts', () => {
  it('shows the texts admins chose under Branding and the product name in the heading', async () => {
    mockApplicationConfig({
      product_name: 'LSST Help',
      studenthub_login_panel: {
        heading: 'IT Service Desk',
        tagline: 'Help in one place.',
        description: 'For students and staff.',
      },
    })

    const view = await visitView('/login')

    expect(view.getByText('IT Service Desk')).toBeInTheDocument()
    expect(view.getByText('Help in one place.')).toBeInTheDocument()
    expect(view.getByText('For students and staff.')).toBeInTheDocument()
    expect(view.getByRole('heading', { level: 1, name: 'Sign in to LSST Help' })).toBeInTheDocument()
  })

  it('hides a line whose text is empty', async () => {
    mockApplicationConfig({
      product_name: 'Student Hub',
      studenthub_login_panel: { heading: 'Student Hub', tagline: '', description: 'For students and staff.' },
    })

    const view = await visitView('/login')

    expect(view.queryByText('Your support, simplified.')).not.toBeInTheDocument()
    expect(view.getByText('For students and staff.')).toBeInTheDocument()
  })

  it('shows the default texts before the setting exists', async () => {
    mockApplicationConfig({ product_name: 'Student Hub', studenthub_login_panel: undefined })

    const view = await visitView('/login')

    expect(view.getByText('Your support, simplified.')).toBeInTheDocument()
  })
})
