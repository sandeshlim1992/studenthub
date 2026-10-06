// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { waitFor } from '@testing-library/vue'

import { renderComponent } from '#tests/support/components/index.ts'

import StudenthubAppColorSetting from '../StudenthubAppColorSetting.vue'

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('StudenthubAppColorSetting', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit = {}) => {
      if (init.method === 'PUT') return Promise.resolve(jsonResponse({ id: 77 }))
      return Promise.resolve(
        jsonResponse([
          { id: 12, name: 'product_name', state_current: { value: 'Student Hub' } },
          { id: 77, name: 'studenthub_app_color', state_current: { value: '#296374' } },
        ]),
      )
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // The controls stay disabled until the saved colour has loaded.
  const renderLoaded = async () => {
    const view = renderComponent(StudenthubAppColorSetting)
    await waitFor(() => expect(view.getByLabelText('Hex code')).toBeEnabled())
    return view
  }

  it('shows the saved colour and keeps Save disabled until something changes', async () => {
    const view = await renderLoaded()

    expect(view.getByLabelText('Hex code')).toHaveValue('#296374')
    expect(view.getByRole('radio', { name: 'Teal' })).toHaveAttribute('aria-checked', 'true')
    expect(view.getByRole('button', { name: 'Save colour' })).toBeDisabled()
  })

  it('saves a chosen preset', async () => {
    const view = await renderLoaded()

    await view.events.click(view.getByRole('radio', { name: 'Plum' }))
    await view.events.click(view.getByRole('button', { name: 'Save colour' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/settings/77',
        expect.objectContaining({ method: 'PUT', body: JSON.stringify({ state_current: { value: '#4b2a7a' } }) }),
      ),
    )
    expect(await view.findByText('Application colour saved. Everyone sees it after their next page load.')).toBeInTheDocument()
  })

  it('refuses a colour that is too light for white text', async () => {
    const view = await renderLoaded()

    const hex = view.getByLabelText('Hex code')
    await view.events.clear(hex)
    await view.events.type(hex, '#ffca08')

    expect(view.getByText(/Choose a darker colour/)).toBeInTheDocument()
    expect(view.getByRole('button', { name: 'Save colour' })).toBeDisabled()
  })
})
