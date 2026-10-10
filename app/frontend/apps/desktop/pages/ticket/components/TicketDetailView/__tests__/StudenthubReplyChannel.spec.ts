// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { computed, ref, shallowRef } from 'vue'

import { renderComponent } from '#tests/support/components/index.ts'
import { mockPermissions } from '#tests/support/mock-permissions.ts'

import { createDummyTicket } from '#shared/entities/ticket-article/__tests__/mocks/ticket.ts'

import StudenthubReplyBoxFooter from '../StudenthubReplyBoxFooter.vue'
import StudenthubTicketReplyBar from '../StudenthubTicketReplyBar.vue'

const openReplyForm = vi.fn()

vi.mock('#shared/entities/ticket/composables/useTicketArticleReplyAction.ts', () => ({
  useTicketArticleReplyAction: () => ({ openReplyForm, getNewArticleBody: () => '' }),
}))

const sendingGroup = { emailAddress: { name: 'IT', emailAddress: 'it@studenthub.ac' } }

const ticket = ref(createDummyTicket({ group: sendingGroup }))

vi.mock('#desktop/pages/ticket/composables/useTicketInformation.ts', () => ({
  useTicketInformation: () => ({
    ticket: computed(() => ticket.value),
    ticketInternalId: computed(() => ticket.value.internalId),
    isTicketEditable: computed(() => true),
    form: shallowRef(undefined),
    showTicketArticleReplyForm: vi.fn(),
  }),
}))

describe('Student Hub reply box: Email or Web', () => {
  beforeEach(() => {
    mockPermissions(['ticket.agent'])
    ticket.value = createDummyTicket({ group: sendingGroup })
  })

  it('sends a reply by email unless Web is picked', async () => {
    const view = renderComponent(StudenthubTicketReplyBar)

    expect(view.getByRole('radio', { name: 'Email' })).toHaveAttribute('aria-checked', 'true')

    await view.events.click(view.getByTestId('studenthub-reply-box-input'))

    expect(openReplyForm).toHaveBeenLastCalledWith({
      articleType: 'email',
      internal: false,
      subtype: 'reply',
      to: ['nicole.braun@zammad.org'],
    })
  })

  it('posts the reply on the web when Web is picked', async () => {
    const view = renderComponent(StudenthubTicketReplyBar)

    await view.events.click(view.getByRole('radio', { name: 'Web' }))
    expect(view.getByRole('radio', { name: 'Web' })).toHaveAttribute('aria-checked', 'true')

    await view.events.click(view.getByTestId('studenthub-reply-box-input'))

    expect(openReplyForm).toHaveBeenLastCalledWith({ articleType: 'web', internal: false })
  })

  it('falls back to Web when the ticket’s group has no address to send from', async () => {
    ticket.value = createDummyTicket()

    const view = renderComponent(StudenthubTicketReplyBar)

    const email = view.getByRole('radio', { name: 'Email' })
    expect(email).toHaveAttribute('aria-disabled', 'true')
    expect(view.getByRole('radio', { name: 'Web' })).toHaveAttribute('aria-checked', 'true')

    await view.events.click(email)
    await view.events.click(view.getByTestId('studenthub-reply-box-input'))

    expect(openReplyForm).toHaveBeenLastCalledWith({ articleType: 'web', internal: false })
  })

  it('offers the choice for replies only', () => {
    const view = renderComponent(StudenthubReplyBoxFooter, {
      props: { mode: 'note', channel: 'email', canEmail: true },
    })

    expect(view.queryByRole('radiogroup', { name: 'Send by' })).not.toBeInTheDocument()
  })
})
