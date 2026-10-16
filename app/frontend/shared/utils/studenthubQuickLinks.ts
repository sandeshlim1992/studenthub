// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

// Student Hub: the mobile app's quick links (setting "studenthub_mobile_quick_links"), set by admins
// on the new UI's Mobile app page and shown on the mobile app's Home. The server checks them as
// well (Setting::Validation::StudenthubMobileQuickLinks), with the same limits.

export interface StudenthubQuickLink {
  label: string
  url: string
}

export const STUDENTHUB_QUICK_LINKS_MAX = 8
export const STUDENTHUB_QUICK_LINK_LABEL_MAX = 40
export const STUDENTHUB_QUICK_LINK_URL_MAX = 500

// The site an http(s) address leads to, for people to see before they follow it; nothing for
// any other address.
export const studenthubQuickLinkSite = (url: string) => {
  try {
    const { protocol, hostname } = new URL(url)
    if (protocol !== 'http:' && protocol !== 'https:') return undefined

    return hostname.replace(/^www\./, '') || undefined
  } catch {
    return undefined
  }
}

const isQuickLink = (link: unknown): link is StudenthubQuickLink =>
  typeof link === 'object' &&
  link !== null &&
  typeof (link as StudenthubQuickLink).label === 'string' &&
  typeof (link as StudenthubQuickLink).url === 'string'

// The links from the app config, leaving out any that aren't a label and a web address.
export const readStudenthubQuickLinks = (value: unknown): StudenthubQuickLink[] => {
  if (!Array.isArray(value)) return []

  return value
    .filter(isQuickLink)
    .filter((link) => link.label.trim() && studenthubQuickLinkSite(link.url))
}
