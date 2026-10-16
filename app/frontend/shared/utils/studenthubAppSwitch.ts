// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

// Student Hub: phones get the mobile app (/mobile), other devices the new UI (/). A phone stays on
// the new UI when the person chose "Continue to desktop" in the mobile app, and on the pages only
// the new UI has (password reset, sign-up, the Knowledge Base, admin pages…), so their links work.

export interface AppSwitch {
  location: Pick<Location, 'pathname' | 'search' | 'hash'>
  phone: boolean
  chosenDesktop: boolean
  systemReady: boolean
}

// A ticket, also with a message's number after it (/tickets/42/7).
const TICKET_PATH = /^\/tickets\/(\d+)(?:\/|$)/

const mobilePageFor = ({ pathname, search, hash }: AppSwitch['location']) => {
  if (pathname === '/') return `/mobile/${hash}`
  if (pathname === '/login' && !search) return '/mobile/login'

  const ticket = TICKET_PATH.exec(pathname)
  if (ticket) return `/mobile/tickets/${ticket[1]}`
}

// Where the new UI sends a phone, or undefined to stay.
export const mobileAppAddress = ({ location, phone, chosenDesktop, systemReady }: AppSwitch) => {
  if (!phone || chosenDesktop || !systemReady) return

  return mobilePageFor(location)
}
