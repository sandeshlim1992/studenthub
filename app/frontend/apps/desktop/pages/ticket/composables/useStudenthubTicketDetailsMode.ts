// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { computed, reactive, type MaybeRefOrGetter, toValue } from 'vue'

// Student Hub: whether a ticket's Details section shows the read-only list or Zammad's
// form. Shared per ticket, so the header actions can open the form (e.g. to pick an owner).
const editing = reactive(new Map<number, boolean>())

export const useStudenthubTicketDetailsMode = (ticketId: MaybeRefOrGetter<number | undefined>) => {
  const isEditingDetails = computed({
    get: () => {
      const id = toValue(ticketId)
      return id ? (editing.get(id) ?? false) : false
    },
    set: (value: boolean) => {
      const id = toValue(ticketId)
      if (id) editing.set(id, value)
    },
  })

  return { isEditingDetails }
}
