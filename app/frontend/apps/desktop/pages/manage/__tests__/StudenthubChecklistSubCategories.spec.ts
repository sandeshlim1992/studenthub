// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { renderComponent } from '#tests/support/components/index.ts'

import { setCSRFToken } from '#shared/server/apollo/utils/csrfToken.ts'

import StudenthubChecklistSubCategories from '../components/Checklists/StudenthubChecklistSubCategories.vue'
import Checklists from '../views/Checklists.vue'

import type { ChecklistAssignmentsData } from '../components/Checklists/types.ts'

const data: ChecklistAssignmentsData = {
  assignments: [
    { id: 1, category: 'Service Request', sub_category: 'Onboarding', checklist_template_id: 3, missing: false },
    { id: 2, category: 'Service Request', sub_category: 'Old', checklist_template_id: 3, missing: true },
    { id: 3, category: 'Service Request', sub_category: 'New ID Card', checklist_template_id: 5, missing: false },
  ],
  categories: [
    { value: 'Service Request', label: 'Service Request' },
    { value: 'Hardware', label: 'Hardware' },
  ],
  sub_categories: {
    'Service Request': [
      { value: 'Onboarding', label: 'Onboarding' },
      { value: 'New ID Card', label: 'New ID Card' },
      { value: 'Laptop Request', label: 'Laptop Request' },
    ],
    Hardware: [{ value: 'Printer', label: 'Printer' }],
  },
}

describe('Checklists › Add automatically to tickets in', () => {
  it('adds and removes sub-categories, but not one another checklist gets', async () => {
    const view = renderComponent(StudenthubChecklistSubCategories, {
      props: {
        templateId: 3,
        data,
        templateNames: { 3: 'Onboarding', 5: 'ID card' },
        modelValue: [
          { category: 'Service Request', sub_category: 'Onboarding' },
          { category: 'Service Request', sub_category: 'Old' },
        ],
        'onUpdate:modelValue': (value: unknown) => view.rerender({ modelValue: value }),
      },
    })

    expect(view.getByText('Service Request › Old').parentElement).toHaveTextContent(
      'No longer a sub-category',
    )

    await view.events.selectOptions(view.getByLabelText('Category'), 'Service Request')
    const subCategory = view.getByLabelText('Sub-category')
    expect(view.getByRole('option', { name: 'New ID Card (gets "ID card")' })).toBeDisabled()
    expect(view.getByRole('option', { name: 'Onboarding' })).toBeDisabled()

    await view.events.selectOptions(subCategory, 'Laptop Request')
    await view.events.click(view.getByRole('button', { name: 'Add' }))
    await view.events.click(view.getByRole('button', { name: 'Remove Service Request › Old' }))

    expect(view.emitted('update:modelValue')?.at(-1)).toEqual([
      [
        { category: 'Service Request', sub_category: 'Onboarding' },
        { category: 'Service Request', sub_category: 'Laptop Request' },
      ],
    ])
  })
})

describe('Checklists page', () => {
  const template = { id: 3, name: 'Onboarding', active: true }

  const mockServer = () => {
    const calls: { method: string; url: string; body?: any }[] = []

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit = {}) => {
        const method = init.method ?? 'GET'
        const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined
        calls.push({ method, url, body })

        const replies: Record<string, unknown> = {
          'GET /api/v1/checklist_templates?expand=true': [template],
          'GET /api/v1/settings/checklist': { value: true },
          'GET /api/v1/studenthub/checklist_assignments': data,
          'GET /api/v1/checklist_templates/3?full=true': {
            ...template,
            sorted_item_ids: [],
            items: [{ id: 1, text: 'Account' }],
          },
          'PUT /api/v1/checklist_templates/3': template,
          'PUT /api/v1/studenthub/checklist_assignments/3': { assignments: [] },
        }

        return new Response(JSON.stringify(replies[`${method} ${url}`] ?? {}), { status: 200 })
      }),
    )

    return calls
  }

  beforeEach(() => {
    setCSRFToken('token-1')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows where a checklist is added and saves its sub-categories after the checklist', async () => {
    const calls = mockServer()

    const view = renderComponent(Checklists, {
      router: true,
      store: true,
      global: { stubs: { LayoutContent: { template: '<div><slot /></div>' } } },
    })

    expect(
      await view.findByText('Added to: Service Request › Onboarding, Service Request › Old'),
    ).toBeInTheDocument()

    await view.events.click(view.getByText('Onboarding', { selector: 'td' }))
    await view.events.click(
      await view.findByRole('button', { name: 'Remove Service Request › Old' }),
    )
    await view.events.click(view.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() =>
      expect(calls.map(({ method, url }) => `${method} ${url}`)).toContain(
        'PUT /api/v1/studenthub/checklist_assignments/3',
      ),
    )
    const saves = calls.filter((call) => call.method === 'PUT').map((call) => call.url)
    expect(saves).toEqual([
      '/api/v1/checklist_templates/3',
      '/api/v1/studenthub/checklist_assignments/3',
    ])
    expect(calls.find((call) => call.url === '/api/v1/studenthub/checklist_assignments/3')?.body).toEqual({
      sub_categories: [{ category: 'Service Request', sub_category: 'Onboarding' }],
    })
  })
})
