// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { computed, ref, shallowRef } from 'vue'

import { renderComponent } from '#tests/support/components/index.ts'
import { mockPermissions } from '#tests/support/mock-permissions.ts'

import { createDummyTicket } from '#shared/entities/ticket-article/__tests__/mocks/ticket.ts'

import StudenthubTicketSlaBox from '../../TicketSidebar/TicketSidebarInformation/TicketSidebarInformationContent/StudenthubTicketSlaBox.vue'
import StudenthubArticleKind from '../ArticleBubble/StudenthubArticleKind.vue'
import StudenthubTicketHeaderActions from '../TicketDetailTopBar/components/StudenthubTicketHeaderActions.vue'

const openReplyForm = vi.fn()

vi.mock('#shared/entities/ticket/composables/useTicketArticleReplyAction.ts', () => ({
  useTicketArticleReplyAction: () => ({ openReplyForm, getNewArticleBody: () => '' }),
}))

const ticket = createDummyTicket()

vi.mock('#desktop/pages/ticket/composables/useTicketInformation.ts', () => ({
  useTicketInformation: () => ({
    ticket: computed(() => ticket),
    ticketInternalId: ref(ticket.internalId),
    isTicketEditable: computed(() => true),
    form: shallowRef(undefined),
    showTicketArticleReplyForm: vi.fn(),
  }),
}))

describe('Student Hub ticket screen', () => {
  describe('message label', () => {
    it.each([
      [{ internal: true, sender: { name: 'Agent' }, type: { name: 'note' } }, 'Internal note'],
      [{ internal: false, sender: { name: 'Agent' }, type: { name: 'email' } }, 'Reply'],
      [{ internal: false, sender: { name: 'Customer' }, type: { name: 'email' } }, 'Email'],
      [{ internal: false, sender: { name: 'Customer' }, type: { name: 'web' } }, 'Web form'],
      [{ internal: false, sender: { name: 'System' }, type: { name: 'email' } }, 'System'],
    ])('labels %o as %s', (article, label) => {
      const view = renderComponent(StudenthubArticleKind, { props: { article } })

      expect(view.getByText(label)).toBeInTheDocument()
    })
  })

  describe('SLA box', () => {
    beforeEach(() => {
      vi.useFakeTimers({ now: new Date('2026-10-04T12:00:00Z') })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    const slaTicket = (fields: Record<string, string | null>) => ({
      internalId: 1,
      createdAt: '2026-10-04T08:00:00Z',
      updatedAt: '2026-10-04T08:00:00Z',
      firstResponseEscalationAt: null,
      updateEscalationAt: null,
      closeEscalationAt: null,
      ...fields,
    })

    it('shows the open deadlines, the resolution time and the time left', () => {
      const view = renderComponent(StudenthubTicketSlaBox, {
        props: {
          ticket: slaTicket({
            firstResponseEscalationAt: '2026-10-04T12:30:00Z',
            closeEscalationAt: '2026-10-04T16:00:00Z',
          }),
        },
      })

      expect(view.getByText('First response')).toBeInTheDocument()
      expect(view.getByText('due in 30 min')).toBeInTheDocument()
      expect(view.getByText('Resolution due')).toBeInTheDocument()
      expect(view.getByText('Time left')).toBeInTheDocument()
      expect(view.getByText('4 h')).toBeInTheDocument()
      // 4 of 8 hours have passed.
      expect(view.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
    })

    it('marks an overdue resolution', () => {
      const view = renderComponent(StudenthubTicketSlaBox, {
        props: { ticket: slaTicket({ closeEscalationAt: '2026-10-04T10:00:00Z' }) },
      })

      expect(view.getByText('overdue 2 h')).toBeInTheDocument()
      expect(view.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    })

    it('says so when no SLA applies', () => {
      const view = renderComponent(StudenthubTicketSlaBox, { props: { ticket: slaTicket({}) } })

      expect(view.getByText('No SLA applies to this ticket.')).toBeInTheDocument()
    })
  })

  describe('header actions', () => {
    beforeEach(() => {
      mockPermissions(['ticket.agent'])
    })

    it('offers the mockup actions', () => {
      const view = renderComponent(StudenthubTicketHeaderActions, { router: true, store: true })

      const toolbar = view.getByRole('toolbar', { name: 'Ticket header actions' })
      expect(toolbar).toHaveTextContent('Reply')
      expect(view.getByRole('button', { name: 'Add note' })).toBeInTheDocument()
      expect(view.getByRole('button', { name: 'Assign' })).toBeInTheDocument()
      expect(view.getByRole('button', { name: 'Merge' })).toBeInTheDocument()
    })

    it('opens an internal note from Add note', async () => {
      const view = renderComponent(StudenthubTicketHeaderActions, { router: true, store: true })

      await view.events.click(view.getByRole('button', { name: 'Add note' }))

      expect(openReplyForm).toHaveBeenCalledWith({ articleType: 'note', internal: true })
    })

    it('only offers Reply to students', () => {
      mockPermissions(['ticket.customer'])

      const view = renderComponent(StudenthubTicketHeaderActions, { router: true, store: true })

      expect(view.getByRole('button', { name: 'Reply' })).toBeInTheDocument()
      expect(view.queryByRole('button', { name: 'Add note' })).not.toBeInTheDocument()
      expect(view.queryByRole('button', { name: 'Assign' })).not.toBeInTheDocument()
      expect(view.queryByRole('button', { name: 'Merge' })).not.toBeInTheDocument()
    })
  })
})
