// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

// Student Hub: the mobile app (/mobile) is for students on a phone; staff and other devices get the
// new UI (/). A student's phone stays on the new UI when they chose "Continue to desktop" in the
// mobile app, and on the pages only the new UI has (password reset, sign-up, the Knowledge Base…),
// so their links work. A computer may still open /mobile directly.

export interface AppSwitch {
  location: Pick<Location, 'pathname' | 'search' | 'hash'>
  phone: boolean
  staff: boolean
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

// Where the new UI sends a phone, or undefined to stay. Staff are only known once signed in, so
// a signed-out phone goes to the mobile sign-in, which sends staff on (desktopAppAddress).
export const mobileAppAddress = ({
  location,
  phone,
  staff,
  chosenDesktop,
  systemReady,
}: AppSwitch) => {
  if (!phone || staff || chosenDesktop || !systemReady) return

  return mobilePageFor(location)
}

// Where the mobile app sends staff on a phone, from a path inside it (/tickets/42), or undefined
// to stay.
export const desktopAppAddress = ({
  path,
  phone,
  staff,
}: {
  path: string
  phone: boolean
  staff: boolean
}) => {
  if (!phone || !staff) return

  const ticket = TICKET_PATH.exec(path)
  return ticket ? `/tickets/${ticket[1]}` : '/'
}
