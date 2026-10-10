// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { within } from '@testing-library/vue'

import { renderComponent } from '#tests/support/components/index.ts'

import RequestFormPreview from '#desktop/pages/manage/components/RequestForms/RequestFormPreview.vue'

import StudenthubRequestSummary from '../StudenthubRequestSummary.vue'

describe('StudenthubRequestSummary', () => {
  it('lists the steps taken, each with Change, and Details as the current one', async () => {
    const view = renderComponent(StudenthubRequestSummary, {
      props: {
        category: 'Service Request',
        subCategory: 'Onboarding (New Starter)',
        campus: 'Campus',
      },
    })

    const card = view.getByRole('complementary', { name: 'Your request' })
    expect(card).toHaveTextContent('Service Request')
    expect(card).toHaveTextContent('Onboarding (New Starter)')

    await view.events.click(view.getByRole('button', { name: 'Change request' }))
    await view.events.click(view.getByRole('button', { name: 'Change campus' }))
    expect(view.emitted('change')).toEqual([[2], [3]])

    const current = view.getAllByRole('listitem').find((item) => item.getAttribute('aria-current'))
    expect(current).toHaveTextContent('Details')
  })
})

describe('Request form preview: the Details step', () => {
  const definition = {
    category: 'Service Request',
    sub_category: 'Onboarding (New Starter)',
    title: '',
    help_text: '',
    items: [{ type: 'heading' as const, text: 'Employee' }],
    fields: [],
    organization_ids: [],
    role_ids: [],
  }

  it('puts the Subject at the top of the form and asks for no Description', () => {
    const view = renderComponent(RequestFormPreview, {
      props: { definition, categoryLabel: 'Service Request' },
      form: true,
      router: true,
    })

    expect(view.getByRole('complementary', { name: 'Your request' })).toBeInTheDocument()

    const form = view.getByTestId('studenthub-request-form')
    expect(within(form).getByText('Subject / Short Title')).toBeInTheDocument()
    expect(view.queryByText('Description / Issue Details')).not.toBeInTheDocument()
  })

  it('keeps the Description while the form is still empty', () => {
    const view = renderComponent(RequestFormPreview, {
      props: { definition: { ...definition, items: [] }, categoryLabel: 'Service Request' },
      form: true,
      router: true,
    })

    expect(view.queryByTestId('studenthub-request-form')).not.toBeInTheDocument()
    expect(view.getByText('Subject / Short Title')).toBeInTheDocument()
    expect(view.getByText('Description / Issue Details')).toBeInTheDocument()
  })
})
