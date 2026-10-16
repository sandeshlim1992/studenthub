// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { inject, provide, ref, watch, type Ref } from 'vue'

import { NotificationTypes } from '#shared/components/CommonNotifications/types.ts'
import { useNotifications } from '#shared/components/CommonNotifications/useNotifications.ts'
import type { TicketById } from '#shared/entities/ticket/types.ts'
import { StudenthubApiError, studenthubApi } from '#shared/utils/studenthubApi.ts'
import {
  studenthubCustomerTicketPath,
  type StudenthubCustomerTicketOverview,
} from '#shared/utils/studenthubCustomerTicket.ts'

// Student Hub: the student's chat on the mobile ticket screen. TicketDetailView loads where the
// request stands and what the student can do, and loads it again whenever the ticket changes; the
// chat header, the "Did this solve your problem?" card and the chat box share it.

export interface StudenthubCustomerTicket {
  overview: Ref<StudenthubCustomerTicketOverview | null>
  isBusy: Ref<boolean>
  // The student said the problem is not solved: the chat box asks what is still wrong.
  isNotSolved: Ref<boolean>
  run: (action: 'close' | 'rating' | 'reply', body: unknown, success?: string) => Promise<boolean>
}

const STUDENTHUB_CUSTOMER_TICKET_SYMBOL = Symbol('studenthub-customer-ticket')

export const provideStudenthubCustomerTicket = (
  ticket: Ref<TicketById | undefined>,
  isStudent: Ref<boolean>,
) => {
  const { notify } = useNotifications()

  const overview = ref<StudenthubCustomerTicketOverview | null>(null)
  const isBusy = ref(false)
  const isNotSolved = ref(false)
  let loadRequest = 0

  const load = async (ticketId: number) => {
    const request = ++loadRequest
    try {
      const data = await studenthubApi<StudenthubCustomerTicketOverview>(
        studenthubCustomerTicketPath(ticketId),
      )
      if (request === loadRequest) overview.value = data
    } catch {
      // Without it the chat still shows the conversation; the card and the closed notes wait.
    }
  }

  watch(
    () => [isStudent.value, ticket.value?.internalId, ticket.value?.updatedAt] as const,
    ([student, ticketId]) => {
      if (!student || !ticketId) return
      load(ticketId)
    },
    { immediate: true },
  )

  const run: StudenthubCustomerTicket['run'] = async (action, body, success) => {
    if (!ticket.value) return false

    isBusy.value = true
    try {
      overview.value = await studenthubApi<StudenthubCustomerTicketOverview>(
        studenthubCustomerTicketPath(ticket.value.internalId, action),
        { method: 'POST', body },
      )
      // A chat message shows up in the conversation, so it needs no notice.
      if (success)
        notify({
          id: `studenthub-customer-${action}`,
          type: NotificationTypes.Success,
          message: success,
        })
      return true
    } catch (error) {
      notify({
        id: `studenthub-customer-${action}-error`,
        type: NotificationTypes.Error,
        message:
          error instanceof StudenthubApiError
            ? error.message
            : __('Something went wrong. Please try again.'),
      })
      return false
    } finally {
      isBusy.value = false
    }
  }

  const context: StudenthubCustomerTicket = { overview, isBusy, isNotSolved, run }
  provide(STUDENTHUB_CUSTOMER_TICKET_SYMBOL, context)

  return context
}

export const useStudenthubCustomerTicket = () =>
  inject(STUDENTHUB_CUSTOMER_TICKET_SYMBOL) as StudenthubCustomerTicket
