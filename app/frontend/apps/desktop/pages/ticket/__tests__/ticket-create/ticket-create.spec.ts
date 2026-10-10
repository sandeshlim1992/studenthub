// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { waitFor, within } from '@testing-library/vue'
import { beforeEach } from 'vitest'

import ticketArticleCustomerObjectAttributes from '#tests/graphql/factories/fixtures/ticket-article-customer-object-attributes.ts'
import ticketCustomerObjectAttributes from '#tests/graphql/factories/fixtures/ticket-customer-object-attributes.ts'
import { getTestRouter } from '#tests/support/components/renderComponent.ts'
import { visitView } from '#tests/support/components/visitView.ts'
import { mockApplicationConfig } from '#tests/support/mock-applicationConfig.ts'
import { mockPermissions } from '#tests/support/mock-permissions.ts'

import { mockObjectManagerFrontendAttributesQuery } from '#shared/entities/object-attributes/graphql/queries/objectManagerFrontendAttributes.mocks.ts'
import { waitForTicketCreateMutationCalls } from '#shared/entities/ticket/graphql/mutations/create.mocks.ts'
import {
  EnumObjectManagerObjects,
  EnumTaskbarEntity,
  EnumTaskbarEntityAccess,
} from '#shared/graphql/types.ts'
import { convertToGraphQLId } from '#shared/graphql/utils.ts'
import getUuid from '#shared/utils/getUuid.ts'

import { mockUserCurrentTaskbarItemAddMutation } from '#desktop/entities/user/current/graphql/mutations/userCurrentTaskbarItemAdd.mocks.ts'
import { waitForUserCurrentTaskbarItemDeleteMutationCalls } from '#desktop/entities/user/current/graphql/mutations/userCurrentTaskbarItemDelete.mocks.ts'
import { waitForUserCurrentTaskbarItemUpdateMutationCalls } from '#desktop/entities/user/current/graphql/mutations/userCurrentTaskbarItemUpdate.mocks.ts'
import { mockUserCurrentTaskbarItemListQuery } from '#desktop/entities/user/current/graphql/queries/userCurrentTaskbarItemList.mocks.ts'
import {
  handleMockUserQuery,
  handleCustomerMock,
  handleMockFormUpdaterQuery,
  rendersFields,
  handleMockOrganizationQuery,
} from '#desktop/pages/ticket/__tests__/support/ticket-create-helpers.ts'

vi.hoisted(() => {
  vi.setSystemTime('2024-11-11T00:00:00Z')
})

describe('ticket create view', () => {
  describe('view with granted access', () => {
    beforeEach(() => {
      mockApplicationConfig({
        ui_task_mananger_max_task_count: 30,
        ui_ticket_create_available_types: ['phone-in', 'phone-out', 'email-out'],
      })
      mockPermissions(['ticket.agent'])
    })

    it('keeps form values on cancel unsaved changes', async () => {
      handleMockFormUpdaterQuery()

      const view = await visitView('/ticket/create')

      await view.events.type(await view.findByLabelText('Summary'), 'Test Ticket')

      // Student Hub: Cancel in the header asks first once something is entered (the heading shows
      // the summary once the form has it)
      await view.findByRole('heading', { level: 1, name: 'Test Ticket' })
      await view.events.click(view.getByRole('button', { name: 'Cancel' }))

      const dialog = await view.findByRole('dialog', {
        name: 'Unsaved changes',
      })

      const dialogView = within(dialog)

      await view.events.click(dialogView.getByRole('button', { name: 'Cancel & go back' }))

      expect(view.getByLabelText('Summary')).toHaveValue('Test Ticket')
    })

    it('prevents submission on incomplete form', async () => {
      handleMockFormUpdaterQuery({
        pending_time: {
          show: true,
        },
      })

      const view = await visitView('/ticket/create')

      await view.events.type(await view.findByLabelText('Summary'), 'Test Ticket')

      await view.events.click(view.getByRole('button', { name: 'Create ticket' }))

      expect(await view.findAllByText('This field is required.')).toHaveLength(4)
    })

    it('creates a new ticket', async () => {
      handleMockFormUpdaterQuery({
        pending_time: {
          show: true,
        },
      })

      const view = await visitView('/ticket/create')

      await view.events.type(await view.findByLabelText('Summary'), 'Test Ticket')

      // Page title updates when title is set
      expect(
        await view.findByRole('heading', { level: 1, name: 'Test Ticket' }),
      ).toBeInTheDocument()

      // Page title defaults back when title is cleared
      await view.events.clear(view.getByLabelText('Summary'))

      await waitFor(() =>
        expect(view.getByRole('heading', { level: 1, name: 'New ticket' })).toBeInTheDocument(),
      )

      await view.events.type(view.getByLabelText('Summary'), 'Test Ticket')

      // Customer field
      await handleCustomerMock(view)

      handleMockUserQuery()

      await view.events.click(
        view.getByRole('option', {
          name: 'Avatar (Nicole Braun) Nicole Braun – Zammad Foundation',
        }),
      )

      // Student Hub: the Customer panel opens beside the form, next to the panel icons
      const sidebar = await view.findByRole('region', { name: 'Customer' })

      // Sidebar CUSTOMER
      expect(await within(sidebar).findByLabelText('Avatar (Nicole Braun)')).toBeInTheDocument()
      expect(within(sidebar).getByText('Zammad Foundation')).toBeInTheDocument()
      expect(within(sidebar).getByText('nicole.braun@zammad.org')).toBeInTheDocument()
      expect(within(sidebar).getByText('open tickets')).toBeInTheDocument()
      expect(within(sidebar).queryByText('closed tickets')).not.toBeInTheDocument() // 0 closed tickets
      // The count of open tickets is on the Customer icon
      const panelIcons = view.getByRole('navigation', { name: 'Ticket panels' })
      expect(within(panelIcons).getByLabelText('Open tickets')).toHaveTextContent('17')

      await view.events.click(within(sidebar).getByLabelText('Action menu button'))

      const popover = await view.findByRole('region', { name: 'Action menu button' })

      expect(within(popover).getByRole('button', { name: 'Edit customer' })).toBeInTheDocument()

      // Sidebar Organization
      handleMockOrganizationQuery()

      await view.events.click(within(panelIcons).getByRole('button', { name: 'Organization' }))

      const organizationPanel = await view.findByRole('region', { name: 'Organization' })

      expect(await within(organizationPanel).findByText('Members')).toBeInTheDocument()
      expect(
        await within(organizationPanel).findByLabelText('Avatar (Nicole Braun)'),
      ).toBeInTheDocument()

      // Details field
      await view.events.type(view.getByRole('textbox', { name: 'Details' }), 'Test ticket text')

      // Team field
      await view.events.click(view.getByLabelText('Team'))
      await view.events.click(view.getByRole('option', { name: 'Users' }))

      // Priority buttons
      await view.events.click(
        within(view.getByRole('group', { name: 'Priority' })).getByRole('button', {
          name: '2 normal',
        }),
      )

      // State field
      await view.events.click(view.getByLabelText('State'))
      await view.events.click(view.getByRole('option', { name: 'pending reminder' }))

      // Date selection Field on pending reminder
      await view.events.click(view.getByLabelText('Pending till'))

      const dateCells: Element[] = await view.findAllByRole('gridcell', { name: /29/ })

      await view.events.click(<Element>dateCells.at(-1))

      // Submission
      await view.events.click(view.getByRole('button', { name: 'Create ticket' }))

      const calls = await waitForTicketCreateMutationCalls()

      expect(calls.at(-1)?.variables).toEqual({
        input: {
          article: {
            body: 'Test ticket text',
            cc: undefined,
            contentType: 'text/html',
            security: undefined,
            sender: 'Customer',
            type: 'phone',
          },
          customer: {
            id: 'gid://zammad/User/2',
          },
          groupId: 'gid://zammad/Group/1',
          objectAttributeValues: [],
          pendingTime: '2024-11-29T00:00:00Z',
          priorityId: 'gid://zammad/Ticket::Priority/2',
          stateId: 'gid://zammad/Ticket::State/3',
          title: 'Test Ticket',
          sharedDraftId: undefined,
        },
      })

      expect(await view.findByRole('alert')).toHaveTextContent(
        'Ticket has been created successfully.',
      )
    })

    it('renders view correctly', async () => {
      const view = await visitView('/ticket/create')

      expect(await view.findByRole('heading', { level: 1, name: 'New ticket' })).toBeInTheDocument()

      // Student Hub: how the ticket came in is a select, Received call by default
      expect(await view.findByLabelText('Came in by')).toHaveTextContent('Received call')
      expect(await view.findByRole('group', { name: 'Priority' })).toBeInTheDocument()

      rendersFields(view)
    })

    it('cancels ticket creation', async () => {
      // The mocked tabs all get the same ID; this one gets its own, as it is removed (the store
      // keeps removed IDs, so a later tab with the same ID would count as removed too).
      mockUserCurrentTaskbarItemAddMutation({
        userCurrentTaskbarItemAdd: {
          taskbarItem: { id: convertToGraphQLId('Taskbar', 999) },
        },
      })

      const view = await visitView('/ticket/create')

      expect(await view.findByRole('heading', { level: 1, name: 'New ticket' })).toBeInTheDocument()

      // Student Hub: nothing entered, so Cancel leaves without asking and removes the new ticket
      // from Recent
      await view.events.click(view.getByRole('button', { name: 'Cancel' }))

      await waitFor(() =>
        expect(
          view.queryByRole('heading', { level: 1, name: 'New ticket' }),
        ).not.toBeInTheDocument(),
      )

      await waitForUserCurrentTaskbarItemDeleteMutationCalls()
    })

    it('shows send email article type', async () => {
      const view = await visitView('/ticket/create')

      await view.events.click(await view.findByLabelText('Came in by'))
      await view.events.click(await view.findByRole('option', { name: 'Send email' }))

      expect(view.getByLabelText('Came in by')).toHaveTextContent('Send email')
      expect(view.getByLabelText('CC')).toBeInTheDocument()
      rendersFields(view)
    })

    it('shows outbound call article type', async () => {
      const view = await visitView('/ticket/create')

      await view.events.click(await view.findByLabelText('Came in by'))
      await view.events.click(await view.findByRole('option', { name: 'Outbound call' }))

      expect(view.getByLabelText('Came in by')).toHaveTextContent('Outbound call')
      expect(view.queryByLabelText('CC')).not.toBeInTheDocument()
      rendersFields(view)
    })

    it('detects duplicate ticket', async () => {
      await mockApplicationConfig({
        ticket_duplicate_detection: true,
        ticket_duplicate_detection_title: 'Similar tickets found',
        ticket_duplicate_detection_body: 'Tickets with the same attributes were found.',
      })

      handleMockFormUpdaterQuery({
        ticket_duplicate_detection: {
          show: true,
          hidden: false,
          value: { count: 1, items: [[1, '123,', 'foo title']] },
        },
      })

      const view = await visitView('/ticket/create')

      await view.events.type(await view.findByLabelText('Summary'), 'foo title')

      await waitFor(() => expect(view.getByText('Similar tickets found')).toBeInTheDocument())

      expect(view.getByTestId('common-alert')).toHaveTextContent('foo title')

      expect(view.getByIconName('exclamation-triangle')).toBeInTheDocument()

      expect(view.getByText('Tickets with the same attributes were found.')).toBeInTheDocument()
    })

    it('prevents submission on incomplete form', async () => {
      handleMockFormUpdaterQuery({
        pending_time: {
          show: true,
        },
      })

      const view = await visitView('/ticket/create')

      await view.events.type(await view.findByLabelText('Summary'), 'Test Ticket')

      await view.events.click(view.getByRole('button', { name: 'Create ticket' }))

      expect(await view.findAllByText('This field is required.')).toHaveLength(4)
    })

    it('discards unsaved changes', async () => {
      handleMockFormUpdaterQuery()

      const view = await visitView('/ticket/create')

      // Student Hub: Cancel in the header asks first once something is entered (the heading shows
      // the summary once the form has it)
      await view.events.type(await view.findByLabelText('Summary'), 'Test Ticket')
      await view.findByRole('heading', { level: 1, name: 'Test Ticket' })

      await view.events.click(view.getByRole('button', { name: 'Cancel' }))

      const dialog = await view.findByRole('dialog', {
        name: 'Unsaved changes',
      })

      expect(dialog).toBeInTheDocument()

      const dialogView = within(dialog)

      expect(
        await dialogView.findByText('Are you sure? You have unsaved changes that will get lost.'),
      )

      await view.events.click(dialogView.getByRole('button', { name: 'Discard changes' }))

      // should not be in the document anymore
      await waitFor(() => expect(view.queryByLabelText('Summary')).not.toBeInTheDocument())
    })

    it('supports updating dirty flag in the associated taskbar tab', async () => {
      const uid = getUuid()

      mockUserCurrentTaskbarItemListQuery({
        userCurrentTaskbarItemList: [
          {
            __typename: 'UserTaskbarItem',
            id: convertToGraphQLId('Taskbar', 1),
            key: `TicketCreateScreen-${uid}`,
            callback: EnumTaskbarEntity.TicketCreate,
            entityAccess: EnumTaskbarEntityAccess.Granted,
            entity: {
              __typename: 'UserTaskbarItemEntityTicketCreate',
              uid,
              title: '',
              createArticleTypeKey: 'phone-in',
            },
            dirty: false,
          },
        ],
      })

      handleMockFormUpdaterQuery()

      const view = await visitView(`/ticket/create/${uid}`)

      await view.events.type(await view.findByLabelText('Summary'), 'Test Ticket')

      const calls = await waitForUserCurrentTaskbarItemUpdateMutationCalls()

      expect(calls.at(-1)?.variables).toEqual(
        expect.objectContaining({
          input: expect.objectContaining({
            dirty: true,
          }),
        }),
      )
    })

    it('shows alert for missing attachments', async () => {
      handleMockFormUpdaterQuery()

      const view = await visitView('/ticket/create')

      await view.events.type(await view.findByLabelText('Summary'), 'Test Ticket')

      // Customer field
      await handleCustomerMock(view)

      handleMockUserQuery()

      await view.events.click(
        view.getByRole('option', {
          name: 'Avatar (Nicole Braun) Nicole Braun – Zammad Foundation',
        }),
      )

      // Details field
      await view.events.type(
        view.getByRole('textbox', { name: 'Details' }),
        'Test ticket text. See attachment.',
      )

      // Team field
      await view.events.click(view.getByLabelText('Team'))
      await view.events.click(view.getByRole('option', { name: 'Users' }))

      // Priority buttons
      await view.events.click(
        within(view.getByRole('group', { name: 'Priority' })).getByRole('button', {
          name: '2 normal',
        }),
      )

      // State field
      await view.events.click(view.getByLabelText('State'))
      await view.events.click(view.getByRole('option', { name: 'new' }))

      // Submission
      await view.events.click(view.getByRole('button', { name: 'Create ticket' }))

      const dialog = await view.findByRole('dialog', {
        name: 'Confirmation',
      })
      expect(dialog).toBeInTheDocument()

      const dialogView = within(dialog)
      expect(
        dialogView.getByText('Did you plan to include attachments with this message?'),
      ).toBeInTheDocument()
    })
  })

  describe('with customer permission', () => {
    beforeEach(() => {
      mockPermissions(['ticket.customer'])
    })

    describe('view disabled customer ticket create', () => {
      beforeEach(() => {
        mockApplicationConfig({
          customer_ticket_create: false,
        })
        mockPermissions(['ticket.customer'])
      })

      it('redirects to error page', async () => {
        const view = await visitView('/ticket/create')

        const router = getTestRouter()

        await waitFor(() => expect(router.currentRoute.value.path).toBe('/error-tab'))

        expect(view.getByText('Forbidden')).toBeInTheDocument()
        expect(view.getByText('Creating new tickets via web is disabled.')).toBeInTheDocument()
      })
    })

    describe('view enabled customer ticket create', () => {
      beforeEach(() => {
        mockApplicationConfig({
          customer_ticket_create: true,
        })
      })

      it('creates a new ticket', async () => {
        mockObjectManagerFrontendAttributesQuery(({ object }) => {
          const attributes =
            object === EnumObjectManagerObjects.Ticket
              ? ticketCustomerObjectAttributes()
              : ticketArticleCustomerObjectAttributes()

          return { objectManagerFrontendAttributes: attributes }
        })

        handleMockFormUpdaterQuery()

        // Student Hub: students start in the guided wizard; this is the full form
        const view = await visitView('/ticket/create?mode=form')

        await view.events.type(await view.findByLabelText('Title'), 'Test Customer Ticket')

        // Text field
        await view.events.type(
          view.getByRole('textbox', { name: 'Text' }),
          'Test customer ticket text',
        )

        await view.events.click(view.getByLabelText('Group'))
        await view.events.click(view.getByRole('option', { name: 'Users' }))

        // Submission
        await view.events.click(view.getByRole('button', { name: 'Create' }))

        const calls = await waitForTicketCreateMutationCalls()

        expect(calls.at(-1)?.variables).toEqual({
          input: {
            article: {
              body: 'Test customer ticket text',
              cc: undefined,
              contentType: 'text/html',
              security: undefined,
              sender: 'Customer',
              type: 'web',
            },
            customer: undefined,
            groupId: 'gid://zammad/Group/1',
            objectAttributeValues: [],
            stateId: 'gid://zammad/Ticket::State/2',
            title: 'Test Customer Ticket',
          },
        })

        expect(await view.findByRole('alert')).toHaveTextContent(
          'Ticket has been created successfully.',
        )
      })
    })
  })
})
