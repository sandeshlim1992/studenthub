// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { within } from '@testing-library/vue'

import { visitView } from '#tests/support/components/visitView.ts'
import { mockApplicationConfig } from '#tests/support/mock-applicationConfig.ts'
import { mockGraphQLApi } from '#tests/support/mock-graphql-api.ts'
import { mockPermissions } from '#tests/support/mock-permissions.ts'
import { mockUserCurrent } from '#tests/support/mock-userCurrent.ts'

import { FormUploadCacheAddDocument } from '#shared/components/Form/fields/FieldFile/graphql/mutations/uploadCache/add.api.ts'
import { FormUpdaterDocument } from '#shared/components/Form/graphql/queries/formUpdater.api.ts'
import { ObjectManagerFrontendAttributesDocument } from '#shared/entities/object-attributes/graphql/queries/objectManagerFrontendAttributes.api.ts'
import { TicketCreateDocument } from '#shared/entities/ticket/graphql/mutations/create.api.ts'

import {
  ticketObjectAttributes,
  ticketPayload,
} from '#mobile/entities/ticket/__tests__/mocks/ticket-mocks.ts'

const choices = (...names: string[]) => names.map((name) => ({ name, value: name }))

const metadata = {
  categories: choices('Service Request', 'Software', 'Hardware'),
  subcategories_by_category: {
    'Service Request': choices(
      'New ID Card',
      'Password Reset',
      'Onboarding (New Starter)',
      'Others',
    ),
    Software: choices(
      'MS Office Suite',
      'Outlook',
      'IBM SPSS',
      'Windows OS',
      'Web Browsers',
      'LSST Portal',
      'Others',
    ),
    Hardware: choices('Laptop', 'Printer', 'Others'),
  },
  campuses: choices('LSST Wembley', 'LSST Luton', 'FSB Sheffield', 'UKBC Leicester'),
}

const onboardingForm = {
  id: 7,
  sub_category: 'Onboarding (New Starter)',
  items: [
    { type: 'note', text: 'We set up accounts two working days before the start date.' },
    {
      type: 'question',
      key: 'role',
      label: 'Their role',
      kind: 'select',
      help: '',
      required: true,
      options: ['Lecturer', 'Admin'],
    },
    { type: 'field', name: 'start_date', required: true },
  ],
  fields: [{ name: 'start_date', required: true }],
}

const selectAttribute = (name: string, display: string) => ({
  name,
  display,
  dataType: 'select',
  dataOption: { options: {}, translate: false, null: true },
  isInternal: false,
  screens: {},
  __typename: 'ObjectManagerFrontendAttribute',
})

const mockServer = (form: unknown = null) => {
  const requests: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      requests.push(url)
      if (url === '/api/v1/studenthub/ticket_wizard_metadata')
        return new Response(JSON.stringify(metadata))
      if (url.startsWith('/api/v1/studenthub/request_forms/applicable?'))
        return new Response(JSON.stringify(form))
      return new Response('{}', { status: 404 })
    }),
  )
  return requests
}

const mockTicketGraphQL = () => {
  const attributes = ticketObjectAttributes()
  mockGraphQLApi(ObjectManagerFrontendAttributesDocument).willResolve({
    objectManagerFrontendAttributes: {
      ...attributes,
      attributes: [
        ...attributes.attributes,
        selectAttribute('category2', 'Category'),
        selectAttribute('subcategory', 'Sub-Category'),
        selectAttribute('campus', 'Campus'),
        {
          ...selectAttribute('start_date', 'Start date'),
          dataType: 'date',
          dataOption: { null: true },
        },
      ],
    },
  })
  mockGraphQLApi(FormUpdaterDocument).willResolve({
    formUpdater: {
      fields: { group_id: { show: true, options: [{ label: 'Unassigned Tickets', value: 33 }] } },
    },
  })
  return mockGraphQLApi(TicketCreateDocument).willResolve({
    ticketCreate: { ticket: ticketPayload(42), errors: null, __typename: 'TicketCreatePayload' },
  })
}

const conversation = (view: Awaited<ReturnType<typeof visitView>>) =>
  view.getByRole('log', { name: 'Conversation' })

// Student Hub: students' New request as a chat (design B with E's search).
describe('Student Hub request chat', () => {
  beforeEach(() => {
    mockUserCurrent({ firstname: 'Sam' })
    mockPermissions(['ticket.customer'])
    mockApplicationConfig({ customer_ticket_create: true })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('finds a sub-category by typing and sends the request', async () => {
    mockServer()
    const ticketCreate = mockTicketGraphQL()

    const view = await visitView('/tickets/request')

    expect(
      await view.findByText(
        'Hi Sam. What do you need help with? Type a few words or pick a category.',
      ),
    ).toBeInTheDocument()

    await view.events.type(
      view.getByRole('searchbox', { name: 'Search what you need help with' }),
      'card',
    )
    await view.events.click(
      within(view.getByRole('group', { name: 'Matches' })).getByRole('button', {
        name: /New ID Card/,
      }),
    )

    expect(within(conversation(view)).getByText('New ID Card')).toBeInTheDocument()
    expect(await view.findByText('Which campus are you at?')).toBeInTheDocument()

    const campuses = view.getByRole('group', { name: 'Which campus are you at?' })
    expect(within(campuses).getByText('LSST')).toBeInTheDocument()
    await view.events.click(within(campuses).getByRole('button', { name: 'LSST Wembley' }))

    const message = await view.findByRole('textbox', {
      name: 'Tell us what happened. A sentence or two is enough, and you can add photos.',
    })
    await view.events.type(message, 'Lost it')
    await view.events.click(view.getByRole('button', { name: 'Send' }))

    expect(view.getByText('Please write at least 10 characters.')).toHaveAttribute('role', 'alert')

    await view.events.type(message, ' on the bus, <b>please</b> help')
    await view.events.click(view.getByRole('button', { name: 'Send' }))

    const request = view.getByRole('region', { name: 'Your request' })
    expect(within(request).getByLabelText('Subject')).toHaveValue('New ID Card - LSST Wembley')

    await view.events.click(within(request).getByRole('button', { name: 'Send request' }))

    expect(await view.findByText('Sent as ticket #7842')).toBeInTheDocument()
    expect(view.getByRole('link', { name: 'View ticket' })).toHaveAttribute(
      'href',
      '/mobile/tickets/42',
    )

    const { input } = ticketCreate.spies.resolve.mock.calls[0][0]
    expect(input).toMatchObject({
      title: 'New ID Card - LSST Wembley',
      groupId: 'gid://zammad/Group/33',
      article: { type: 'web', sender: 'Customer', contentType: 'text/html' },
      objectAttributeValues: expect.arrayContaining([
        { name: 'category2', value: 'Service Request' },
        { name: 'subcategory', value: 'New ID Card' },
        { name: 'campus', value: 'LSST Wembley' },
      ]),
    })
    expect(input.article.body).toContain(
      '<strong>Category:</strong> Service Request &gt; New ID Card',
    )
    expect(input.article.body).toContain('&lt;b&gt;please&lt;/b&gt;')
    expect(input.article.body).not.toContain('<b>please</b>')
  })

  it('sends the photos added to the request', async () => {
    mockServer()
    const ticketCreate = mockTicketGraphQL()
    const upload = mockGraphQLApi(FormUploadCacheAddDocument).willResolve({
      formUploadCacheAdd: {
        uploadedFiles: [
          { id: '5', name: 'card.jpg', size: 4, type: 'image/jpeg', __typename: 'StoredFile' },
        ],
        __typename: 'FormUploadCacheAddPayload',
      },
    })

    const view = await visitView('/tickets/request')
    await view.events.type(
      await view.findByRole('searchbox', { name: 'Search what you need help with' }),
      'card',
    )
    await view.events.click(view.getByRole('button', { name: /New ID Card/ }))
    await view.events.click(await view.findByRole('button', { name: 'LSST Luton' }))
    await view.events.upload(
      view.getByLabelText('Add a photo or file', { selector: 'input' }),
      new File(['card'], 'card.jpg', { type: 'image/jpeg' }),
    )
    await view.events.type(
      view.getByRole('textbox', { name: /Tell us what happened/ }),
      'My card is broken in half',
    )
    await view.events.click(view.getByRole('button', { name: 'Send' }))

    const request = await view.findByRole('region', { name: 'Your request' })
    expect(within(request).getByText('card.jpg')).toBeInTheDocument()

    await view.events.click(within(request).getByRole('button', { name: 'Send request' }))
    await view.findByText('Sent as ticket #7842')

    const { formId } = upload.spies.resolve.mock.calls[0][0]
    const { input } = ticketCreate.spies.resolve.mock.calls[0][0]
    expect(input.article.attachments).toEqual({
      formId,
      files: [{ name: 'card.jpg', type: 'image/jpeg' }],
    })
  })

  it('offers the sub-categories of a picked category and lets the student change an answer', async () => {
    mockServer()
    mockTicketGraphQL()

    const view = await visitView('/tickets/request')
    const categories = await view.findByRole('group', {
      name: 'Hi Sam. What do you need help with? Type a few words or pick a category.',
    })
    await view.events.click(within(categories).getByRole('button', { name: 'Software' }))

    const subs = await view.findByRole('group', { name: 'Which of these is it?' })
    expect(
      within(subs)
        .getAllByRole('button')
        .map((button) => button.textContent?.trim()),
    ).toEqual([
      'MS Office Suite',
      'Outlook',
      'IBM SPSS',
      'Windows OS',
      'Web Browsers',
      'LSST Portal',
      'Show all 7',
    ])

    await view.events.click(within(subs).getByRole('button', { name: 'Show all 7' }))
    await view.events.click(within(subs).getByRole('button', { name: 'Others' }))
    await view.events.click(view.getByRole('button', { name: 'Change: Software' }))

    expect(view.getByRole('group', { name: /What do you need help with/ })).toBeInTheDocument()
    expect(view.queryByText('Which of these is it?')).not.toBeInTheDocument()
  })

  it("asks the request form's questions instead of what happened", async () => {
    const requests = mockServer(onboardingForm)
    const ticketCreate = mockTicketGraphQL()

    const view = await visitView('/tickets/request')
    await view.events.type(
      await view.findByRole('searchbox', { name: 'Search what you need help with' }),
      'onboarding',
    )
    await view.events.click(view.getByRole('button', { name: /Onboarding \(New Starter\)/ }))
    await view.events.click(await view.findByRole('button', { name: 'FSB Sheffield' }))

    expect(requests).toContain(
      '/api/v1/studenthub/request_forms/applicable?category=Service+Request&sub_category=Onboarding+%28New+Starter%29',
    )
    expect(
      await view.findByText('We set up accounts two working days before the start date.'),
    ).toBeInTheDocument()

    await view.events.click(
      within(view.getByRole('group', { name: 'Their role' })).getByRole('button', {
        name: 'Lecturer',
      }),
    )
    await view.events.type(await view.findByLabelText('Start date'), '2026-11-02')
    await view.events.click(view.getByRole('button', { name: 'Send' }))

    expect(view.queryByRole('textbox', { name: /Tell us what happened/ })).not.toBeInTheDocument()

    const request = await view.findByRole('region', { name: 'Your request' })
    await view.events.click(within(request).getByRole('button', { name: 'Send request' }))
    await view.findByText('Sent as ticket #7842')

    const { input } = ticketCreate.spies.resolve.mock.calls[0][0]
    expect(input.article.preferences).toEqual({
      studenthub_request_answers: { form_id: 7, answers: { role: 'Lecturer' } },
    })
    expect(input.objectAttributeValues).toContainEqual({ name: 'start_date', value: '2026-11-02' })
  })

  it('says so when students may not raise requests', async () => {
    mockServer()
    mockTicketGraphQL()
    mockApplicationConfig({ customer_ticket_create: false })

    const view = await visitView('/tickets/request')

    expect(
      await view.findByText('Raising requests is switched off. Please contact Student Support.'),
    ).toBeInTheDocument()
    expect(view.queryByText(/What do you need help with/)).not.toBeInTheDocument()
    expect(view.queryByRole('searchbox')).not.toBeInTheDocument()
  })

  it('says so when the choices cannot be loaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 500 })),
    )
    mockTicketGraphQL()

    const view = await visitView('/tickets/request')

    expect(
      await view.findByText(
        'New request is not available right now. Please try again in a moment.',
      ),
    ).toBeInTheDocument()
    expect(view.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})
