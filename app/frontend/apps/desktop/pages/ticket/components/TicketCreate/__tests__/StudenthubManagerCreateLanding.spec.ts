// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { renderComponent } from '#tests/support/components/index.ts'

import StudenthubManagerCreateLanding from '../StudenthubManagerCreateLanding.vue'

describe('StudenthubManagerCreateLanding', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the student card with Raise a New Ticket only, without Talk to Student Support', () => {
    const view = renderComponent(StudenthubManagerCreateLanding)

    expect(view.getByRole('heading', { level: 1, name: 'How can we help?' })).toBeInTheDocument()
    expect(view.getByRole('button', { name: 'Raise a New Ticket' })).toBeInTheDocument()
    expect(view.queryByText('Talk to Student Support')).not.toBeInTheDocument()
  })

  it('opens the form from Raise a New Ticket', async () => {
    const view = renderComponent(StudenthubManagerCreateLanding)

    await view.events.click(view.getByRole('button', { name: 'Raise a New Ticket' }))

    expect(view.emitted('raise')).toHaveLength(1)
  })

  it('opens the wizard for the chosen category', async () => {
    const view = renderComponent(StudenthubManagerCreateLanding)

    expect(view.getByRole('heading', { level: 2, name: 'Choose a Category' })).toBeInTheDocument()

    await view.events.click(view.getByRole('button', { name: /Software Support/ }))

    expect(view.emitted('category')).toEqual([
      [expect.objectContaining({ key: 'software', categoryValue: 'Software' })],
    ])
  })

  it('uses the categories from the server when there are any', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ categories: [{ name: 'Facilities', value: 'Facilities' }] }),
      }),
    )

    const view = renderComponent(StudenthubManagerCreateLanding)

    expect(await view.findByRole('button', { name: /Facilities/ })).toBeInTheDocument()
    expect(view.queryByRole('button', { name: /Software Support/ })).not.toBeInTheDocument()
  })
})
