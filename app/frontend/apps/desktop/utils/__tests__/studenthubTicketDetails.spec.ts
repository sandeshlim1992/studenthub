// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import {
  articleTypeLabel,
  formatDayTime,
  slaElapsedShare,
  slaResult,
} from '#desktop/utils/studenthubTicketDetails.ts'

describe('studenthubTicketDetails', () => {
  it('labels article types', () => {
    expect(articleTypeLabel('web')).toBe('Web form')
    expect(articleTypeLabel('custom type')).toBe('custom type')
    expect(articleTypeLabel(null)).toBe('')
  })

  it('names today, tomorrow and yesterday', () => {
    const now = new Date(2026, 9, 4, 12, 0)

    expect(formatDayTime(new Date(2026, 9, 4, 9, 14).toISOString(), now)).toMatch(/^Today 09:14$/)
    expect(formatDayTime(new Date(2026, 9, 5, 17, 0).toISOString(), now)).toMatch(/^Tomorrow /)
    expect(formatDayTime(new Date(2026, 9, 3, 8, 30).toISOString(), now)).toMatch(/^Yesterday /)
    expect(formatDayTime(new Date(2026, 9, 1, 8, 30).toISOString(), now)).not.toMatch(/Today|Tomorrow|Yesterday/)
    expect(formatDayTime(null, now)).toBe('')
  })

  it('works out how much of the SLA time has passed', () => {
    const start = '2026-10-04T08:00:00Z'
    const deadline = '2026-10-04T16:00:00Z'

    expect(slaElapsedShare(start, deadline, Date.parse('2026-10-04T10:00:00Z'))).toBe(0.25)
    expect(slaElapsedShare(start, deadline, Date.parse('2026-10-04T18:00:00Z'))).toBe(1)
    expect(slaElapsedShare(start, deadline, Date.parse('2026-10-04T07:00:00Z'))).toBe(0)
    expect(slaElapsedShare(null, deadline, 0)).toBe(0)
  })

  it('reads the SLA result Zammad stores', () => {
    expect(slaResult(25)).toBe('met')
    expect(slaResult(0)).toBe('met')
    expect(slaResult(-3)).toBe('missed')
    expect(slaResult(null)).toBeNull()
  })
})
