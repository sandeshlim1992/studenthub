// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { renderComponent } from '#tests/support/components/index.ts'

import { EnumObjectManagerObjects } from '#shared/graphql/types.ts'

import { requestFormSchema, splitRequestFormValues } from '../requestFormSchema.ts'
import StudenthubRequestFormSection from '../StudenthubRequestFormSection.vue'

describe('StudenthubRequestFormSection', () => {
  it('shows the form heading, then its headings and notes in order (no fields yet)', async () => {
    const view = renderComponent(StudenthubRequestFormSection, {
      props: {
        form: {
          sub_category: 'Onboarding (New Starter)',
          title: 'Staff onboarding',
          items: [
            { type: 'heading', text: 'Employee' },
            { type: 'note', text: 'We set up the account before the start date.' },
            { type: 'heading', text: '$ Budget' },
          ],
          fields: [],
        },
      },
      form: true,
      attachTo: document.body,
      router: true,
    })

    expect(view.getByRole('heading', { level: 3, name: 'Staff onboarding' })).toBeInTheDocument()

    const headings = await view.findAllByRole('heading', { level: 4 })
    expect(headings.map((heading) => heading.textContent)).toEqual(['Employee', '$ Budget'])
    expect(view.getByText('We set up the account before the start date.')).toBeInTheDocument()
  })

  it('builds the form schema: fields in order with headings and notes between them', () => {
    const schema = requestFormSchema({
      sub_category: 'Onboarding (New Starter)',
      items: [
        { type: 'heading', text: 'Employee' },
        { type: 'field', name: 'start_date', required: true },
        { type: 'note', text: '$ costs are approved by your manager.' },
        { type: 'field', name: 'laptop', required: false },
      ],
      fields: [],
    })

    expect(schema).toEqual([
      expect.objectContaining({ isLayout: true, element: 'h4', children: 'Employee' }),
      { name: 'start_date', object: EnumObjectManagerObjects.Ticket, required: true },
      expect.objectContaining({
        isLayout: true,
        element: 'p',
        children: '\\$ costs are approved by your manager.',
      }),
      { name: 'laptop', object: EnumObjectManagerObjects.Ticket, required: false },
    ])
  })

  it('reads a form from before items as its fields', () => {
    expect(
      requestFormSchema({
        sub_category: 'Onboarding (New Starter)',
        fields: [{ name: 'start_date', required: true }],
      }),
    ).toEqual([{ name: 'start_date', object: EnumObjectManagerObjects.Ticket, required: true }])
  })

  it("draws the form's own questions with Zammad's field types", () => {
    const schema = requestFormSchema({
      sub_category: 'Onboarding (New Starter)',
      items: [
        { type: 'question', key: 'full_name', label: 'Full name', kind: 'text', help: 'As on the contract', required: true },
        { type: 'question', key: 'model', label: 'Model', kind: 'select', help: '', required: false, options: ['Standard', 'High-spec'] },
        { type: 'question', key: 'extras', label: 'Extras', kind: 'multiselect', help: '', required: false, options: ['Mouse'] },
        { type: 'question', key: 'day_one', label: 'In on day one', kind: 'boolean', help: '', required: true },
        { type: 'question', key: 'start', label: 'Start', kind: 'date', help: '', required: false },
      ],
      fields: [],
    })

    expect(schema).toEqual([
      { type: 'text', name: 'studenthub_question__full_name', label: 'Full name', help: 'As on the contract', required: true, props: {} },
      expect.objectContaining({
        type: 'select',
        name: 'studenthub_question__model',
        required: false,
        props: expect.objectContaining({
          options: [
            { value: 'Standard', label: 'Standard' },
            { value: 'High-spec', label: 'High-spec' },
          ],
          multiple: false,
        }),
      }),
      expect.objectContaining({ type: 'select', props: expect.objectContaining({ multiple: true }) }),
      expect.objectContaining({ type: 'toggle', name: 'studenthub_question__day_one', required: false, value: false }),
      expect.objectContaining({ type: 'date', name: 'studenthub_question__start' }),
    ])
  })

  it("splits the form's values into Zammad fields and answers to its own questions", () => {
    expect(
      splitRequestFormValues({
        campus: 'LSST',
        studenthub_question__full_name: 'Jane Doe',
        studenthub_question__day_one: true,
      }),
    ).toEqual({
      fields: { campus: 'LSST' },
      answers: { full_name: 'Jane Doe', day_one: true },
    })
  })
})
