// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { visitView } from '#tests/support/components/visitView.ts'
import { mockApplicationConfig } from '#tests/support/mock-applicationConfig.ts'
import { mockPermissions } from '#tests/support/mock-permissions.ts'

import { waitForFormUpdaterQueryCalls } from '#shared/components/Form/graphql/queries/formUpdater.mocks.ts'

import { mockTemplatesQuery } from '../../graphql/queries/templates.mocks.ts'

describe('ticket create view - apply template', () => {
  beforeEach(() => {
    mockApplicationConfig({
      ui_ticket_create_available_types: ['phone-in', 'phone-out', 'email-out'],
      customer_ticket_create: true,
    })
    mockPermissions(['ticket.agent'])
  })

  // Student Hub: the button is "Choose a template" at the top of the form (StudenthubTemplatePicker).
  it('renders no "Choose a template" button', async () => {
    mockTemplatesQuery({ templates: [] })

    const view = await visitView('/ticket/create')

    await view.findByRole('heading', { name: 'Who is it for?' })
    expect(view.queryByRole('button', { name: 'Choose a template' })).not.toBeInTheDocument()
  })

  it('renders the "Choose a template" button and can apply the', async () => {
    mockTemplatesQuery({
      templates: [
        { id: '1', name: 'template1' },
        { id: '2', name: 'template2' },
      ],
    })

    const view = await visitView('/ticket/create')

    const applyTemplateButton = await view.findByRole('button', {
      name: 'Choose a template',
    })
    expect(applyTemplateButton).toBeInTheDocument()

    await view.events.click(applyTemplateButton)

    const templateButton = view.getByRole('button', { name: 'template1' })
    expect(templateButton).toBeInTheDocument()
    await view.events.click(templateButton)

    const formUpdaterCalls = await waitForFormUpdaterQueryCalls()

    expect(formUpdaterCalls.at(-1)?.variables).toEqual(
      expect.objectContaining({
        meta: expect.objectContaining({
          additionalData: expect.objectContaining({
            templateId: 'gid://zammad/Template/1',
          }),
        }),
      }),
    )
  })
})
