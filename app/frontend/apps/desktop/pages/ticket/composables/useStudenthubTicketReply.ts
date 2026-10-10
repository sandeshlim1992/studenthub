// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { computed, inject, nextTick, type InjectionKey, type Ref } from 'vue'

import type { FieldEditorContext } from '#shared/components/Form/fields/FieldEditor/types.ts'
import { useTicketArticleReplyAction } from '#shared/entities/ticket/composables/useTicketArticleReplyAction.ts'
import type { TicketArticle } from '#shared/entities/ticket/types.ts'
import { createArticleActions } from '#shared/entities/ticket-article/action/plugins/index.ts'
import { useSessionStore } from '#shared/stores/session.ts'
import { edgesToArray } from '#shared/utils/helpers.ts'

import { ARTICLES_INFORMATION_KEY } from '#desktop/pages/ticket/composables/useArticleContext.ts'
import { useTicketInformation } from '#desktop/pages/ticket/composables/useTicketInformation.ts'

// Student Hub: true on a ticket screen where staff reply from the reply bar, so the messages leave
// out their own Reply (ArticleBubbleActionList). Provided by TicketDetailViewContent.
export const STUDENTHUB_REPLY_BAR_KEY = Symbol('studenthub-reply-bar') as InjectionKey<
  Readonly<Ref<boolean>>
>

// Student Hub: what the agents' reply box writes (design option 1): a reply to the student, an
// internal note or a phone call log.
export type StudenthubReplyMode = 'reply' | 'note' | 'phone'

// Student Hub: "Reply" on the ticket screen (header for students, reply bar for agents) answers
// the student's latest message the way that message's own reply action would (email, web…).
// "Add note" opens an internal note, "Log call" a public phone message.
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

  const targetActions = computed(() => {
    if (!ticket.value || !replyTarget.value) return []
    return createArticleActions(ticket.value, replyTarget.value, 'desktop', {
      onDispose: () => {},
      recalculate: () => {},
    }).filter((action) => action.perform)
  })

  const replyAction = computed(
    () => targetActions.value.find((action) => action.name.endsWith('-reply')) ?? null,
  )

  // Offered only when the student's email went to other people too.
  const replyAllAction = computed(
    () => targetActions.value.find((action) => action.name.endsWith('-reply-all')) ?? null,
  )

  const performOnTarget = (action: (typeof targetActions.value)[number]) => {
    action.perform!(ticket.value!, replyTarget.value!, {
      formId: form?.value?.formId ?? '',
      openReplyForm,
      getNewArticleBody,
    })
  }

  const reply = () => {
    if (!ticket.value) return

    if (replyAction.value && replyTarget.value) {
      performOnTarget(replyAction.value)
      return
    }

    openReplyForm({ articleType: isAgent.value ? 'email' : 'web', internal: false })
  }

  // Reply all on the reply box (it left the message cards): the same reply with every recipient.
  const canReplyAll = computed(() => !!replyAllAction.value)

  const replyAll = () => {
    if (!ticket.value || !replyAllAction.value || !replyTarget.value) return
    performOnTarget(replyAllAction.value)
  }

  const addNote = () => openReplyForm({ articleType: 'note', internal: true })

  const logCall = () => openReplyForm({ articleType: 'phone', internal: false })

  const openMode = (mode: StudenthubReplyMode) => {
    if (mode === 'note') return addNote()
    if (mode === 'phone') return logCall()
    reply()
  }

  // The reply box (option A): open Zammad's form in the chosen mode and put in what was typed
  // into the resting box, at the cursor (above the signature). Switching modes later goes through
  // openMode too, which keeps the text already written.
  const open = async (mode: StudenthubReplyMode, typed = '') => {
    await openMode(mode)

    if (!typed) return

    await nextTick()
    await form?.value?.formNode.settled

    const editor = form?.value?.getNodeByName('body')?.context as FieldEditorContext | undefined
    editor?.focus()
    // The editor takes it as typing (its own input handling), so undo and formatting work as usual.
    document.execCommand?.('insertText', false, typed)
  }

  return { reply, replyAll, canReplyAll, addNote, logCall, openMode, open, isAgent }
}
