// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

// Student Hub: the help center's category icons (Font Awesome codes, chosen on the new UI's
// Knowledge Base page) as the mobile app's own icons; a book where it has none like it.
const topicIcons: Record<string, string> = {
  f02d: 'book',
  f05a: 'info',
  f128: 'info',
  f0a1: 'notification-subscribed',
  f0ad: 'settings',
  f013: 'settings',
  f108: 'desktop',
  f10b: 'phone',
  f1eb: 'web',
  f023: 'lock',
  f084: 'key',
  f0e0: 'mail',
  f007: 'person',
  f0c0: 'organization',
  f19d: 'library',
  f15c: 'file',
}

export const knowledgeBaseTopicIcon = (code: string) => topicIcons[code] ?? 'book'
