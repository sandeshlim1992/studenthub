// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { computed, inject } from 'vue'

import { useTicketArticleReplyAction } from '#shared/entities/ticket/composables/useTicketArticleReplyAction.ts'
import type { TicketArticle } from '#shared/entities/ticket/types.ts'
import { createArticleActions } from '#shared/entities/ticket-article/action/plugins/index.ts'
import { useSessionStore } from '#shared/stores/session.ts'
import { edgesToArray } from '#shared/utils/helpers.ts'

import { ARTICLES_INFORMATION_KEY } from '#desktop/pages/ticket/composables/useArticleContext.ts'
import { useTicketInformation } from '#desktop/pages/ticket/composables/useTicketInformation.ts'

// Student Hub: "Reply" on the ticket screen (header for students, reply bar for agents) answers
// the student's latest message the way that message's own reply action would (email, web…).
// "Add note" opens an internal note.
export const useStudenthubTicketReply = () => {
  const { ticket, form, showTicketArticleReplyForm } = useTicketInformation()
  // The article list provides this; without it Reply opens a plain reply.
  const articleContext = inject(ARTICLES_INFORMATION_KEY, null)
  const { openReplyForm, getNewArticleBody } = useTicketArticleReplyAction(
    form,
    showTicketArticleReplyForm,
  )
  const session = useSessionStore()
  const isAgent = computed(() => session.hasPermission('ticket.agent'))

  const articles = computed<TicketArticle[]>(() => {
    const data = articleContext?.articles.value
    if (!data) return []
    return [...edgesToArray(data.firstArticles), ...edgesToArray(data.articles)] as TicketArticle[]
  })

  // The newest public message from the customer, otherwise the newest public message.
  const replyTarget = computed(() => {
    const visible = articles.value.filter((article) => !article.internal)
    return (
      visible.findLast((article) => article.sender?.name === 'Customer') ?? visible.at(-1) ?? null
    )
  })

  const replyAction = computed(() => {
    if (!ticket.value || !replyTarget.value) return null
    return (
      createArticleActions(ticket.value, replyTarget.value, 'desktop', {
        onDispose: () => {},
        recalculate: () => {},
      }).find((action) => action.name.endsWith('-reply') && action.perform) ?? null
    )
  })

  const reply = () => {
    if (!ticket.value) return

    if (replyAction.value && replyTarget.value) {
      replyAction.value.perform!(ticket.value, replyTarget.value, {
        formId: form?.value?.formId ?? '',
        openReplyForm,
        getNewArticleBody,
      })
      return
    }

    openReplyForm({ articleType: isAgent.value ? 'email' : 'web', internal: false })
  }

  const addNote = () => openReplyForm({ articleType: 'note', internal: true })

  return { reply, addNote, isAgent }
}
