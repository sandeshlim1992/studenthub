// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import {
  escalationStatus,
  escalationWarningMinutes,
  formatEscalationDuration,
  priorityLevelFor,
  splitCampus,
  STUDENTHUB_INSTITUTION_COLORS,
  STUDENTHUB_PRIORITY_STYLES,
  STUDENTHUB_STATE_TONES,
  stateToneFor,
} from '../studenthubTicketList.ts'

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((index) => {
    const channel = parseInt(hex.slice(index, index + 2), 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const contrast = (a: string, b: string) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

// The darkest backgrounds text sits on in the list: zebra stripe and checked row.
const LIST_BACKGROUNDS = ['#ffffff', '#f8f9fb', '#e8e9ed']

const translate = (text: string, ...args: (string | number)[]) =>
  args.reduce<string>((result, arg) => result.replace('%s', String(arg)), text)

describe('studenthubTicketList', () => {
  describe('state colours', () => {
    it('keeps every palette label at WCAG AA', () => {
      Object.values(STUDENTHUB_STATE_TONES).forEach(({ background, text }) => {
        expect(contrast(background, text)).toBeGreaterThanOrEqual(4.5)
      })
    })

    it('uses the colour an admin saved for the state', () => {
      expect(stateToneFor('5', 'open', { 5: 'green' })).toBe('green')
    })

    it('falls back to the state type when nothing (valid) is saved', () => {
      expect(stateToneFor('9', 'open', { 5: 'green' })).toBe('purple')
      expect(stateToneFor('5', 'pending reminder', { 5: '#ff0000' })).toBe('amber')
      expect(stateToneFor('1', 'new', undefined)).toBe('blue')
      expect(stateToneFor('4', 'closed', null)).toBe('grey')
      expect(stateToneFor(undefined, 'something else', {})).toBe('grey')
    })
  })

  describe('priority', () => {
    it('reads the Student Hub P1 to P4 names', () => {
      expect(priorityLevelFor('P1  - Critical', 'high-priority')).toBe('critical')
      expect(priorityLevelFor('P2 - High', 'high-priority')).toBe('high')
      expect(priorityLevelFor('P3 - Normal', null)).toBe('normal')
      expect(priorityLevelFor('P4 - Low', 'low-priority')).toBe('low')
    })

    it("falls back to Zammad's priority colour", () => {
      expect(priorityLevelFor('3 high', 'high-priority')).toBe('high')
      expect(priorityLevelFor('1 low', 'low-priority')).toBe('low')
      expect(priorityLevelFor('None', null)).toBe('none')
    })

    it('keeps priority text readable on list rows', () => {
      Object.values(STUDENTHUB_PRIORITY_STYLES).forEach(({ color }) => {
        LIST_BACKGROUNDS.forEach((background) => {
          expect(contrast(background, color)).toBeGreaterThanOrEqual(4.5)
        })
      })
    })
  })

  describe('escalation', () => {
    const now = Date.parse('2026-10-04T12:00:00Z')

    it('is red once the deadline has passed', () => {
      expect(escalationStatus('2026-10-04T11:15:00Z', now, 60)).toEqual({ status: 'overdue', minutes: 45 })
    })

    it('is amber inside the "due soon" window', () => {
      expect(escalationStatus('2026-10-04T12:35:00Z', now, 60)).toEqual({ status: 'soon', minutes: 35 })
      expect(escalationStatus('2026-10-04T13:00:00Z', now, 60).status).toBe('soon')
      expect(escalationStatus('2026-10-04T12:35:00Z', now, 15).status).toBe('later')
    })

    it('is grey further away, and empty without a deadline', () => {
      expect(escalationStatus('2026-10-05T16:00:00Z', now, 60)).toEqual({ status: 'later', minutes: 1680 })
      expect(escalationStatus(null, now, 60).status).toBe('none')
      expect(escalationStatus('not a date', now, 60).status).toBe('none')
    })

    it('uses the admin setting only when it is a sensible number of minutes', () => {
      expect(escalationWarningMinutes(15)).toBe(15)
      expect(escalationWarningMinutes(0)).toBe(60)
      expect(escalationWarningMinutes('15')).toBe(60)
      expect(escalationWarningMinutes(undefined)).toBe(60)
    })

    it('writes short durations', () => {
      expect(formatEscalationDuration(45, translate)).toBe('45 min')
      expect(formatEscalationDuration(60, translate)).toBe('1 h')
      expect(formatEscalationDuration(200, translate)).toBe('3 h 20 min')
      expect(formatEscalationDuration(1680, translate)).toBe('1 d 4 h')
      expect(formatEscalationDuration(2880, translate)).toBe('2 d')
    })
  })

  describe('campus', () => {
    it('splits the institution from the place', () => {
      expect(splitCampus('LSST Wembley')).toEqual({ institution: 'LSST', place: 'Wembley' })
      expect(splitCampus('LSST Elephant & Castle')).toEqual({ institution: 'LSST', place: 'Elephant & Castle' })
      expect(splitCampus('FSB leicester')).toEqual({ institution: 'FSB', place: 'leicester' })
      expect(splitCampus('UKBC')).toEqual({ institution: 'UKBC', place: '' })
    })

    it('keeps values without an institution as they are', () => {
      expect(splitCampus('MEMO House')).toEqual({ institution: null, place: 'MEMO House' })
      expect(splitCampus('LSSTX Campus')).toEqual({ institution: null, place: 'LSSTX Campus' })
      expect(splitCampus(null)).toEqual({ institution: null, place: '' })
    })

    it('keeps institution badges readable on white', () => {
      Object.values(STUDENTHUB_INSTITUTION_COLORS).forEach((color) => {
        expect(contrast('#ffffff', color)).toBeGreaterThanOrEqual(4.5)
      })
    })
  })
})
