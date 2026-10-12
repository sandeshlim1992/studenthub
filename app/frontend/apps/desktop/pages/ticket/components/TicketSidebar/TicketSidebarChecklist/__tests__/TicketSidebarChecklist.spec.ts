// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { computed, ref } from 'vue'

import { type ExtendedRenderResult, renderComponent } from '#tests/support/components/index.ts'
import { mockApplicationConfig } from '#tests/support/mock-applicationConfig.ts'
import { mockPermissions } from '#tests/support/mock-permissions.ts'
import { mockRouterHooks } from '#tests/support/mock-vue-router.ts'
import { nullableMock, waitForNextTick } from '#tests/support/utils.ts'

import { createDummyTicket } from '#shared/entities/ticket-article/__tests__/mocks/ticket.ts'
import {
  EnumTicketStateColorCode,
  type ChecklistItem,
  type TicketChecklistUpdatesSubscription,
} from '#shared/graphql/types.ts'
import { convertToGraphQLId } from '#shared/graphql/utils.ts'
import type { DeepPartial } from '#shared/types/utils.ts'
import '#tests/graphql/builders/mocks.ts'

import { waitForTicketChecklistAddMutationCalls } from '#desktop/pages/ticket/graphql/mutations/ticketChecklistAdd.mocks.ts'
import { waitForTicketChecklistDeleteMutationCalls } from '#desktop/pages/ticket/graphql/mutations/ticketChecklistDelete.mocks.ts'
import { waitForTicketChecklistItemUpsertMutationCalls } from '#desktop/pages/ticket/graphql/mutations/ticketChecklistItemUpsert.mocks.ts'
import { mockTicketChecklistQuery } from '#desktop/pages/ticket/graphql/queries/ticketChecklist.mocks.ts'
import { getTicketChecklistUpdatesSubscriptionHandler } from '#desktop/pages/ticket/graphql/subscriptions/ticketChecklistUpdates.mocks.ts'
import { TicketSidebarScreenType } from '#desktop/pages/ticket/types/sidebar.ts'

import checklistSidebarPlugin from '../../plugins/checklist.ts'
import TicketSidebarChecklist from '../TicketSidebarChecklist.vue'

const ticket = { value: createDummyTicket() }

vi.mock('#desktop/pages/ticket/composables/useTicketInformation.ts', () => ({
  useTicketInformation: () => ({
    ticketInternalId: ref(ticket.value.internalId),
    ticketId: computed(() => ticket.value.id),
    ticket: computed(() => ticket.value),
    isTicketEditable: computed(() => !!ticket.value?.policy.update),
  }),
}))

vi.mock('#shared/composables/useConfirmation.ts', () => ({
  useConfirmation: () => ({
    waitForConfirmation: () => Promise.resolve(true),
    waitForVariantConfirmation: () => Promise.resolve(true),
  }),
}))

mockRouterHooks()

const checklistItemsMock: ChecklistItem[] = [
  nullableMock<ChecklistItem>({
    __typename: 'ChecklistItem',
    id: convertToGraphQLId('Checklist::Item', 1),
    text: 'Checklist item A',
    checked: false,
    ticketReference: null,
  }),
  nullableMock<ChecklistItem>({
    __typename: 'ChecklistItem',
    id: convertToGraphQLId('Checklist::Item', 2),
    text: 'Checklist item B',
    checked: false,
    ticketReference: null,
  }),
]

type TicketChecklist = NonNullable<
  TicketChecklistUpdatesSubscription['ticketChecklistUpdates']['ticketChecklist']
>

// Overrides the default checklist values if set to null, checklist will be empty
const mockChecklistUpdateSubscription = async (
  partialTicketChecklist: DeepPartial<TicketChecklist> | null,
) => {
  if (partialTicketChecklist === null) {
    await getTicketChecklistUpdatesSubscriptionHandler().trigger(
      nullableMock<TicketChecklistUpdatesSubscription>({
        ticketChecklistUpdates: {
          __typename: 'TicketChecklistUpdatesPayload',
          removedTicketChecklist: null,
          ticketChecklist: null,
        },
      }),
    )
    return
  }

  const ticketChecklist = nullableMock<TicketChecklist>({
    __typename: 'Checklist',
    completed: false,
    incomplete: 2,
    name: 'Checklist title',
    id: convertToGraphQLId('Checklist', 1),
    items: [
      {
        __typename: 'ChecklistItem',
        checked: false,
        id: convertToGraphQLId('Checklist::Item', 1),
        text: 'Checklist item A',
        ticketReference: null,
      },
      {
        __typename: 'ChecklistItem',
        checked: false,
        id: convertToGraphQLId('Checklist::Item', 2),
        text: 'Checklist item B',
        ticketReference: null,
      },
    ],
    ...partialTicketChecklist,
  })

  await getTicketChecklistUpdatesSubscriptionHandler().trigger(
    nullableMock<TicketChecklistUpdatesSubscription>({
      ticketChecklistUpdates: {
        __typename: 'TicketChecklistUpdatesPayload',
        removedTicketChecklist: null,
        ticketChecklist,
      },
    }),
  )
}

const verifyChecked = async (checkboxes: HTMLElement[], withSubscription = true) => {
  const upsertCalls = await waitForTicketChecklistItemUpsertMutationCalls()

  expect(upsertCalls.at(-1)?.variables).toEqual({
    checklistId: convertToGraphQLId('Checklist', 1),
    checklistItemId: convertToGraphQLId('Checklist::Item', 1),
    input: {
      checked: true,
    },
  })

  if (withSubscription) {
    await mockChecklistUpdateSubscription({
      items: [
        {
          checked: true,
          id: convertToGraphQLId('Checklist::Item', 1),
          text: 'Checklist item A',
        },
        {
          checked: false,
          id: convertToGraphQLId('Checklist::Item', 2),
          text: 'Checklist item B',
        },
      ],
    })
  }

  expect(checkboxes[0]).toBeChecked()
}

const renderChecklist = async () => {
  const result = renderComponent(TicketSidebarChecklist, {
    props: {
      sidebar: 'checklist',
      sidebarPlugin: checklistSidebarPlugin,
      selected: true,
      context: {
        screenType: TicketSidebarScreenType.TicketDetailView,
        formValues: {},
        toggleCollapse: () => {},
        isCollapsed: false,
      },
    },
    router: true,
    form: true,
    dialog: true,
  })

  await waitForNextTick()

  return result
}

// Student Hub: the checklist of the ticket's sub-category (useStudenthubChecklistSuggestion).
const suggestionFetch = vi.fn()


// Student Hub: the Checklist tab as steps (design B). Agents only tick and untick; checklists are made
// and assigned by admins (Studenthub::ChecklistRules).
describe('TicketSidebarChecklist', () => {
  beforeAll(() => {
    const app = document.createElement('div')
    app.id = 'ticketSidebar'
    document.body.appendChild(app)
  })

  afterAll(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    ticket.value = createDummyTicket()

    mockApplicationConfig({ ticket_hook: 'TicketTitle#' })
    mockPermissions(['ticket.agent'])

    suggestionFetch.mockReset()
    suggestionFetch.mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', suggestionFetch)
  })

  describe('steps', () => {
    it('shows a state chip, the next step and who ticked the done ones', async () => {
      mockTicketChecklistQuery({
        ticketChecklist: {
          id: convertToGraphQLId('Checklist', 1),
          name: 'Checklist title',
          incomplete: 2,
          items: [
            {
              __typename: 'ChecklistItem',
              id: convertToGraphQLId('Checklist::Item', 1),
              text: 'Checklist item A',
              checked: true,
              updatedAt: new Date().toISOString(),
              updatedBy: { __typename: 'User', id: convertToGraphQLId('User', 2), fullname: 'Sam Okafor' },
              ticketReference: null,
            },
            ...checklistItemsMock.slice(1),
            {
              __typename: 'ChecklistItem',
              id: convertToGraphQLId('Checklist::Item', 3),
              text: 'Checklist item C',
              checked: false,
              ticketReference: null,
            },
          ],
        },
      })

      const wrapper = await renderChecklist()

      expect(await wrapper.findByText('In progress · 1 of 3')).toBeInTheDocument()
      expect(wrapper.getByRole('heading', { level: 3, name: 'Checklist title' })).toBeInTheDocument()
      expect(wrapper.getByText(/Sam Okafor/)).toBeInTheDocument()

      const next = wrapper.getByTestId(`checklist-step-2`)
      expect(next).toHaveTextContent('Next')
      expect(next).toHaveTextContent('Checklist item B')
      expect(wrapper.getAllByRole('button', { name: 'Mark done' })).toHaveLength(1)

      expect(wrapper.getByText(/Set by your admins\./)).toBeInTheDocument()
    })

    it('ticks a step through its checkbox', async () => {
      mockTicketChecklistQuery({
        ticketChecklist: {
          id: convertToGraphQLId('Checklist', 1),
          name: 'Checklist title',
          items: checklistItemsMock,
        },
      })

      const wrapper = await renderChecklist()

      const checkboxes = await wrapper.findAllByRole('checkbox')
      await wrapper.events.click(checkboxes[0])

      await verifyChecked(checkboxes)
    })

    it('ticks the next step with Mark done', async () => {
      mockTicketChecklistQuery({
        ticketChecklist: {
          id: convertToGraphQLId('Checklist', 1),
          name: 'Checklist title',
          items: checklistItemsMock,
        },
      })

      const wrapper = await renderChecklist()

      await wrapper.events.click(await wrapper.findByRole('button', { name: 'Mark done' }))

      await verifyChecked(wrapper.getAllByRole('checkbox'))
    })

    it('unticks a done step', async () => {
      mockTicketChecklistQuery({
        ticketChecklist: {
          id: convertToGraphQLId('Checklist', 1),
          name: 'Checklist title',
          items: [{ ...checklistItemsMock[0], checked: true }, checklistItemsMock[1]],
        },
      })

      const wrapper = await renderChecklist()

      await wrapper.events.click((await wrapper.findAllByRole('checkbox'))[0])

      const upsertCalls = await waitForTicketChecklistItemUpsertMutationCalls()
      expect(upsertCalls.at(-1)?.variables).toEqual({
        checklistId: convertToGraphQLId('Checklist', 1),
        checklistItemId: convertToGraphQLId('Checklist::Item', 1),
        input: { checked: false },
      })
    })

    it('offers no way to add, edit, reorder or delete items', async () => {
      mockTicketChecklistQuery({
        ticketChecklist: {
          id: convertToGraphQLId('Checklist', 1),
          name: 'Checklist title',
          items: checklistItemsMock,
        },
      })

      const wrapper = await renderChecklist()

      expect(await wrapper.findAllByRole('checkbox')).toHaveLength(2)
      expect(wrapper.queryByRole('button', { name: 'Action menu button' })).not.toBeInTheDocument()
      expect(wrapper.queryByRole('button', { name: 'Reorder' })).not.toBeInTheDocument()
      expect(wrapper.queryByRole('button', { name: /Create a new checklist item/ })).not.toBeInTheDocument()
      expect(wrapper.queryByRole('textbox')).not.toBeInTheDocument()
    })

    it('is read-only without permission to change the ticket', async () => {
      mockTicketChecklistQuery({
        ticketChecklist: {
          id: convertToGraphQLId('Checklist', 1),
          name: 'Checklist title',
          items: checklistItemsMock,
        },
      })

      ticket.value = createDummyTicket({ defaultPolicy: { agentReadAccess: true, update: false } })

      const wrapper = await renderChecklist()

      const checkboxes = await wrapper.findAllByRole('checkbox')
      checkboxes.forEach((checkbox) => expect(checkbox).toBeDisabled())
      expect(wrapper.queryByRole('button', { name: 'Mark done' })).not.toBeInTheDocument()
      expect(wrapper.queryByText(/Tick steps as you go/)).not.toBeInTheDocument()
    })

    it('counts a linked ticket as done once it is closed', async () => {
      mockTicketChecklistQuery({
        ticketChecklist: {
          id: convertToGraphQLId('Checklist', 1),
          name: 'Checklist title',
          incomplete: 0,
          items: [
            {
              __typename: 'ChecklistItem',
              id: convertToGraphQLId('Checklist::Item', 1),
              text: '',
              checked: false,
              ticketReference: {
                ticket: {
                  __typename: 'Ticket',
                  id: convertToGraphQLId('Ticket', 7),
                  internalId: 7,
                  number: '990012',
                  title: 'Laptop for new starter',
                  state: { __typename: 'TicketState', id: convertToGraphQLId('TicketState', 4), name: 'closed' },
                  stateColorCode: EnumTicketStateColorCode.Closed,
                },
              },
            },
          ],
        },
      })

      const wrapper = await renderChecklist()

      expect(await wrapper.findByText('Done · 1 of 1')).toBeInTheDocument()
      expect(wrapper.getByText('Linked ticket, closed')).toBeInTheDocument()
      expect(wrapper.queryByRole('checkbox')).not.toBeInTheDocument()
    })

    it('shows access denied for a linked ticket the agent may not see', async () => {
      mockTicketChecklistQuery({
        ticketChecklist: {
          name: 'Checklist title',
          items: [
            {
              __typename: 'ChecklistItem',
              id: convertToGraphQLId('Checklist::Item', 1),
              text: 'Checklist item A',
              checked: false,
              ticketReference: { ticket: null },
            },
          ],
        },
      })

      const wrapper = await renderChecklist()

      expect(await wrapper.findByText('Access denied')).toBeInTheDocument()
    })

    it('lets checklist admins remove the checklist', async () => {
      mockPermissions(['ticket.agent', 'admin.checklist'])

      mockTicketChecklistQuery({
        ticketChecklist: {
          id: convertToGraphQLId('Checklist', 1),
          name: 'Checklist title',
          items: checklistItemsMock,
        },
      })

      const wrapper = await renderChecklist()

      await wrapper.events.click(await wrapper.findByRole('button', { name: 'Action menu button' }))
      await wrapper.events.click(await wrapper.findByRole('button', { name: 'Remove checklist' }))

      const calls = await waitForTicketChecklistDeleteMutationCalls()
      expect(calls.at(-1)?.variables).toEqual({ checklistId: convertToGraphQLId('Checklist', 1) })

      await mockChecklistUpdateSubscription(null)
    })
  })

  describe('checklist of the sub-category', () => {
    it("offers only the checklist of the ticket's sub-category", async () => {
      suggestionFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          checklist_template_id: 5,
          name: 'Onboarding',
          category: 'People',
          sub_category: 'Onboarding',
          item_count: 7,
          first_items: ['Create network account', 'Assign licence', 'Issue laptop'],
        }),
      })

      mockTicketChecklistQuery({ ticketChecklist: null })

      const wrapper = await renderChecklist()

      expect(await wrapper.findByText('This ticket has no checklist yet.')).toBeInTheDocument()
      expect(wrapper.getByText('People › Onboarding')).toBeInTheDocument()
      expect(wrapper.getByText('7 items')).toBeInTheDocument()
      expect(wrapper.getByText('Issue laptop')).toBeInTheDocument()
      expect(wrapper.getByText('and 4 more')).toBeInTheDocument()
      expect(suggestionFetch).toHaveBeenCalledWith(
        '/api/v1/studenthub/checklist_assignments/ticket/1',
        expect.anything(),
      )

      expect(wrapper.queryByRole('button', { name: 'Add empty checklist' })).not.toBeInTheDocument()
      expect(wrapper.queryByRole('button', { name: 'Add from a template' })).not.toBeInTheDocument()

      await wrapper.events.click(wrapper.getByRole('button', { name: 'Add this checklist' }))

      const calls = await waitForTicketChecklistAddMutationCalls()
      expect(calls.at(-1)?.variables).toEqual({
        templateId: convertToGraphQLId('ChecklistTemplate', 5),
        ticketId: convertToGraphQLId('Ticket', 1),
      })
    })

    it('only says there is none when the sub-category has no checklist', async () => {
      mockTicketChecklistQuery({ ticketChecklist: null })

      const wrapper = await renderChecklist()

      expect(await wrapper.findByText('No checklist assigned to this ticket.')).toBeInTheDocument()
      expect(wrapper.queryByRole('button', { name: 'Add this checklist' })).not.toBeInTheDocument()
      expect(wrapper.queryByRole('button', { name: 'Add empty checklist' })).not.toBeInTheDocument()
    })

    it('names the sub-category when it has no checklist', async () => {
      ticket.value = createDummyTicket({
        objectAttributeValues: [
          { attribute: { name: 'category2' }, value: 'Software' },
          { attribute: { name: 'subcategory' }, value: 'Outlook' },
        ],
      })

      mockTicketChecklistQuery({ ticketChecklist: null })

      const wrapper = await renderChecklist()

      expect(await wrapper.findByText('No checklist for Software › Outlook.')).toBeInTheDocument()
    })

    it('does not offer it without permission to change the ticket', async () => {
      suggestionFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          checklist_template_id: 5,
          name: 'Onboarding',
          category: 'People',
          sub_category: 'Onboarding',
          item_count: 1,
          first_items: ['Create network account'],
        }),
      })

      ticket.value = createDummyTicket({ defaultPolicy: { agentReadAccess: true, update: false } })
      mockTicketChecklistQuery({ ticketChecklist: null })

      const wrapper = await renderChecklist()

      expect(await wrapper.findByText('This ticket has no checklist yet.')).toBeInTheDocument()
      expect(wrapper.queryByRole('button', { name: 'Add this checklist' })).not.toBeInTheDocument()
    })

    it('does not ask while the ticket has a checklist', async () => {
      mockTicketChecklistQuery({
        ticketChecklist: {
          id: convertToGraphQLId('Checklist', 1),
          name: 'Checklist title',
          items: [],
        },
      })

      const wrapper = await renderChecklist()

      expect(await wrapper.findByText('Checklist title')).toBeInTheDocument()
      expect(wrapper.getByText('This checklist has no items.')).toBeInTheDocument()
      expect(suggestionFetch).not.toHaveBeenCalled()
    })
  })
})
