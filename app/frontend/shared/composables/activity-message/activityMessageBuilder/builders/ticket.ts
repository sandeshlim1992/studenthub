// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import type { Ticket } from '#shared/graphql/types.ts'
import { i18n } from '#shared/i18n.ts'

import type { ActivityMessageBuilder } from '../types.ts'

const path = (metaObject: Ticket) => {
  return `tickets/${metaObject.internalId}`
}

const messageText = (type: string, authorName: string, metaObject?: Ticket): Maybe<string> => {
  if (!metaObject) {
    return i18n.t('You can no longer see the ticket.')
  }

  const objectTitle = metaObject.title || '-'

  switch (type) {
    case 'create':
      return i18n.t('%s created ticket |%s|', authorName, objectTitle)
    case 'update':
      return i18n.t('%s updated ticket |%s|', authorName, objectTitle)
    case 'reminder_reached':
      return i18n.t('Pending reminder reached for ticket |%s|', objectTitle)
    case 'escalation':
      return i18n.t('Ticket |%s| has escalated!', objectTitle)
    case 'escalation_warning':
      return i18n.t('Ticket |%s| will escalate soon!', objectTitle)
    case 'update.merged_into':
      return i18n.t('Ticket |%s| was merged into another ticket', objectTitle)
    case 'update.received_merge':
      return i18n.t('Another ticket was merged into ticket |%s|', objectTitle)
    // Student Hub: students' notifications about their tickets (Transaction::StudenthubStudentNotification).
    // Students may not see staff's full names (UserPolicy), so a reply comes from the team, as in the chat.
    case 'studenthub_reply':
      return i18n.t('The team replied to |%s|', objectTitle)
    case 'studenthub_progress':
      return i18n.t('Your ticket |%s| is in progress', objectTitle)
    case 'studenthub_waiting':
      return i18n.t('Your ticket |%s| is waiting for your reply', objectTitle)
    case 'studenthub_resolved':
      return i18n.t('Your ticket |%s| was resolved', objectTitle)
    case 'studenthub_closed':
      return i18n.t('Your ticket |%s| was closed', objectTitle)
    default:
      return null
  }
}

export default <ActivityMessageBuilder>{
  path,
  messageText,
  model: 'Ticket',
}
