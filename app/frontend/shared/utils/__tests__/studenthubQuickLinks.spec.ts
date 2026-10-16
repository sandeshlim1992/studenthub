// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { readStudenthubQuickLinks, studenthubQuickLinkSite } from '../studenthubQuickLinks.ts'

describe('studenthubQuickLinkSite', () => {
  it.each([
    ['https://moodle.example.ac.uk/my/', 'moodle.example.ac.uk'],
    ['http://www.example.ac.uk', 'example.ac.uk'],
    ['javascript:alert(1)', undefined],
    ['data:text/html,hi', undefined],
    ['/knowledge-base', undefined],
    ['moodle.example.ac.uk', undefined],
    ['https://', undefined],
  ])('gives %s the site %s', (url, site) => {
    expect(studenthubQuickLinkSite(url)).toBe(site)
  })
})

describe('readStudenthubQuickLinks', () => {
  it('keeps the links with a label and a web address, in order', () => {
    const moodle = { label: 'Moodle', url: 'https://moodle.example.ac.uk' }
    const timetable = { label: 'Timetable', url: 'https://timetable.example.ac.uk' }

    expect(
      readStudenthubQuickLinks([
        moodle,
        { label: 'Bad', url: 'javascript:alert(1)' },
        { label: ' ', url: 'https://example.ac.uk' },
        'https://example.ac.uk',
        null,
        timetable,
      ]),
    ).toEqual([moodle, timetable])
  })

  it('reads anything but a list as no links', () => {
    expect(readStudenthubQuickLinks(undefined)).toEqual([])
    expect(readStudenthubQuickLinks({ label: 'Moodle' })).toEqual([])
  })
})
