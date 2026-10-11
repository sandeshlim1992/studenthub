// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { waitFor } from '@testing-library/vue'

import { renderComponent } from '#tests/support/components/index.ts'

import StudenthubLoginPanelSetting from '../StudenthubLoginPanelSetting.vue'

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const savedTexts = {
  heading: 'Student Hub',
  tagline: 'Your support, simplified.',
  description: 'Help for students.',
}

describe('StudenthubLoginPanelSetting', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let putResponse: Response

  beforeEach(() => {
    putResponse = jsonResponse({ id: 78 })
    fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit = {}) => {
      if (init.method === 'PUT') return Promise.resolve(putResponse)
      return Promise.resolve(
        jsonResponse([
          { id: 12, name: 'product_name', state_current: { value: 'Student Hub' } },
          { id: 78, name: 'studenthub_login_panel', state_current: { value: savedTexts } },
        ]),
      )
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // The fields stay disabled until the saved texts have loaded.
  const renderLoaded = async () => {
    const view = renderComponent(StudenthubLoginPanelSetting)
    await waitFor(() => expect(view.getByLabelText('Heading')).toBeEnabled())
    return view
  }

  it('shows the saved texts and keeps Save disabled until something changes', async () => {
    const view = await renderLoaded()

    expect(view.getByLabelText('Heading')).toHaveValue('Student Hub')
    expect(view.getByLabelText('Tagline')).toHaveValue('Your support, simplified.')
    expect(view.getByLabelText('Description')).toHaveValue('Help for students.')
    expect(view.getByRole('button', { name: 'Save texts' })).toBeDisabled()
  })

  it('saves the changed texts, trimmed, with the CSRF token header', async () => {
    const view = await renderLoaded()

    const heading = view.getByLabelText('Heading')
    await view.events.clear(heading)
    await view.events.type(heading, '  IT Service Desk ')
    await view.events.clear(view.getByLabelText('Tagline'))
    await view.events.click(view.getByRole('button', { name: 'Save texts' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/settings/78',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            state_current: {
              value: { heading: 'IT Service Desk', tagline: '', description: 'Help for students.' },
            },
          }),
        }),
      ),
    )
    expect(await view.findByText('Sign-in page texts saved.')).toBeInTheDocument()
    expect(view.getByRole('button', { name: 'Save texts' })).toBeDisabled()
  })

  it("shows the server's explanation when it refuses the texts", async () => {
    putResponse = jsonResponse({ error: 'The heading can be at most 60 characters long.' }, 422)
    const view = await renderLoaded()

    await view.events.type(view.getByLabelText('Heading'), '!')
    await view.events.click(view.getByRole('button', { name: 'Save texts' }))

    expect(await view.findByText('The heading can be at most 60 characters long.')).toBeInTheDocument()
  })

  it('puts back the default texts', async () => {
    const view = await renderLoaded()

    await view.events.click(view.getByRole('button', { name: 'Use the default texts' }))

    expect(view.getByLabelText('Description')).toHaveValue(
      'IT and student support for LSST, FSB and UKBC. Ask for help, follow your requests and find answers in one place.',
    )
    expect(view.queryByRole('button', { name: 'Use the default texts' })).not.toBeInTheDocument()
  })
})
