// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { type AppSwitch, desktopAppAddress, mobileAppAddress } from '../studenthubAppSwitch.ts'

const studentPhoneAt = (pathname: string, extra: Partial<AppSwitch['location']> = {}) =>
  mobileAppAddress({
    location: { pathname, search: '', hash: '', ...extra },
    phone: true,
    staff: false,
    chosenDesktop: false,
    systemReady: true,
  })

describe('mobileAppAddress', () => {
  it.each([
    ['/', '/mobile/'],
    ['/login', '/mobile/login'],
    ['/tickets/42', '/mobile/tickets/42'],
    ['/tickets/42/7', '/mobile/tickets/42'],
  ])('sends a student on a phone from %s to %s', (pathname, address) => {
    expect(studentPhoneAt(pathname)).toBe(address)
  })

  it('keeps an old #… address for the mobile app to translate', () => {
    expect(studentPhoneAt('/', { hash: '#ticket/zoom/42' })).toBe('/mobile/#ticket/zoom/42')
  })

  it.each([
    '/reset-password/verify/abc',
    '/signup/verify/abc',
    '/knowledge-base',
    '/manage/system/data_privacy',
    '/tickets/create',
  ])('keeps a phone on %s, which only the new UI has', (pathname) => {
    expect(studentPhoneAt(pathname)).toBeUndefined()
  })

  it('keeps a phone on a sign-in link that carries a token', () => {
    expect(studentPhoneAt('/login', { search: '?token=abc' })).toBeUndefined()
  })

  it.each([
    ['a computer or tablet', { phone: false }],
    ['staff on a phone', { staff: true }],
    ['a student who chose the desktop view', { chosenDesktop: true }],
    ['a system that is not set up yet', { systemReady: false }],
  ])('keeps %s on the new UI', (_who, situation) => {
    const address = mobileAppAddress({
      location: { pathname: '/', search: '', hash: '' },
      phone: true,
      staff: false,
      chosenDesktop: false,
      systemReady: true,
      ...situation,
    })

    expect(address).toBeUndefined()
  })
})

describe('desktopAppAddress', () => {
  it.each([
    ['/', '/'],
    ['/login', '/'],
    ['/tickets/42', '/tickets/42'],
    ['/tickets/42/information', '/tickets/42'],
  ])('sends staff on a phone from the mobile app’s %s to %s', (path, address) => {
    expect(desktopAppAddress({ path, phone: true, staff: true })).toBe(address)
  })

  it.each([
    ['a student on a phone', { phone: true, staff: false }],
    ['staff on a computer, who opened /mobile directly', { phone: false, staff: true }],
  ])('leaves %s in the mobile app', (_who, situation) => {
    expect(desktopAppAddress({ path: '/', ...situation })).toBeUndefined()
  })
})
