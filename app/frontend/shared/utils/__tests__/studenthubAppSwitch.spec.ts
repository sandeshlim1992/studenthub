// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { type AppSwitch, mobileAppAddress } from '../studenthubAppSwitch.ts'

const phoneAt = (pathname: string, extra: Partial<AppSwitch['location']> = {}) =>
  mobileAppAddress({
    location: { pathname, search: '', hash: '', ...extra },
    phone: true,
    chosenDesktop: false,
    systemReady: true,
  })

describe('mobileAppAddress', () => {
  it.each([
    ['/', '/mobile/'],
    ['/login', '/mobile/login'],
    ['/tickets/42', '/mobile/tickets/42'],
    ['/tickets/42/7', '/mobile/tickets/42'],
  ])('sends a phone from %s to %s', (pathname, address) => {
    expect(phoneAt(pathname)).toBe(address)
  })

  it('keeps an old #… address for the mobile app to translate', () => {
    expect(phoneAt('/', { hash: '#ticket/zoom/42' })).toBe('/mobile/#ticket/zoom/42')
  })

  it.each([
    '/reset-password/verify/abc',
    '/signup/verify/abc',
    '/knowledge-base',
    '/manage/system/data_privacy',
    '/tickets/create',
  ])('keeps a phone on %s, which only the new UI has', (pathname) => {
    expect(phoneAt(pathname)).toBeUndefined()
  })

  it('keeps a phone on a sign-in link that carries a token', () => {
    expect(phoneAt('/login', { search: '?token=abc' })).toBeUndefined()
  })

  it.each([
    ['a computer or tablet', { phone: false }],
    ['a phone whose owner chose the desktop view', { chosenDesktop: true }],
    ['a system that is not set up yet', { systemReady: false }],
  ])('keeps %s on the new UI', (_who, situation) => {
    const address = mobileAppAddress({
      location: { pathname: '/', search: '', hash: '' },
      phone: true,
      chosenDesktop: false,
      systemReady: true,
      ...situation,
    })

    expect(address).toBeUndefined()
  })
})
