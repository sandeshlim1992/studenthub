// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import {
  backlogChanges,
  canStepForward,
  countTiles,
  currentPeriod,
  niceMax,
  seriesTiles,
  stepPeriod,
  ticketsFromSets,
  type ReportPeriod,
} from '../utils/studenthubReport.ts'

const period = (
  timeRange: ReportPeriod['timeRange'],
  values: Partial<ReportPeriod> = {},
): ReportPeriod => ({
  timeRange,
  year: 2026,
  month: 10,
  week: 41,
  day: 11,
  ...values,
})

describe('Reporting periods', () => {
  it('steps months and days across years and months', () => {
    expect(stepPeriod(period('month', { year: 2026, month: 1 }), -1)).toMatchObject({
      year: 2025,
      month: 12,
    })
    expect(stepPeriod(period('month', { year: 2025, month: 12 }), 1)).toMatchObject({
      year: 2026,
      month: 1,
    })
    expect(stepPeriod(period('day', { month: 3, day: 1 }), -1)).toMatchObject({ month: 2, day: 28 })
  })

  it('steps ISO weeks across years (2020 has 53)', () => {
    expect(stepPeriod(period('week', { year: 2021, week: 1 }), -1)).toMatchObject({
      year: 2020,
      week: 53,
    })
    expect(stepPeriod(period('week', { year: 2020, week: 53 }), 1)).toMatchObject({
      year: 2021,
      week: 1,
    })
    expect(stepPeriod(period('week', { year: 2021, week: 52 }), 1)).toMatchObject({
      year: 2022,
      week: 1,
    })
  })

  it('puts a week in the year of its Thursday', () => {
    expect(currentPeriod('week', new Date(2027, 0, 1))).toMatchObject({ year: 2026, week: 53 })
    expect(currentPeriod('year', new Date(2027, 0, 1))).toMatchObject({ year: 2027 })
  })

  it('does not step into the future', () => {
    const now = new Date(2026, 9, 11, 12)

    expect(canStepForward(period('year'), now)).toBe(false)
    expect(canStepForward(period('year', { year: 2025 }), now)).toBe(true)
    expect(canStepForward(period('month'), now)).toBe(false)
    expect(canStepForward(period('month', { month: 9 }), now)).toBe(true)
    expect(canStepForward(currentPeriod('week', now), now)).toBe(false)
    expect(canStepForward(period('day', { day: 10 }), now)).toBe(true)
    expect(canStepForward(period('realtime'), now)).toBe(false)
  })
})

describe('Reporting figures', () => {
  const data = { 'count::created': [0, 3, 5], 'count::closed': [0, 2, 4] }

  it('sums up created, closed, the backlog and the busiest part', () => {
    const tiles = countTiles(data, period('year'), ['Jan', 'Feb', 'Mar'])

    expect(tiles.map((tile) => [tile.label, tile.value, tile.note])).toEqual([
      ['Created', '8', 'tickets that came in'],
      ['Closed', '6', '75% of those created'],
      ['Backlog', '+2', 'created minus closed'],
      ['Busiest month', 'Mar', '5 created'],
    ])
  })

  it('says when nothing was created', () => {
    const tiles = countTiles({}, period('day'), [])

    expect(tiles[1].note).toBe('none created')
    expect(tiles[3]).toMatchObject({ label: 'Busiest hour', value: '–', note: 'nothing created' })
  })

  it('shows the total and the three biggest series of the other measures', () => {
    const metric = {
      name: 'create_channels',
      display: 'Creation Channels',
      backend: [
        { name: 'a', display: 'Phone (in)' },
        { name: 'b', display: 'Email (in)' },
        { name: 'c', display: 'Web (in)' },
        { name: 'd', display: 'Email (out)' },
      ],
    }
    const tiles = seriesTiles(metric, { a: [1], b: [5], c: [3], d: [1] })

    expect(tiles.map((tile) => [tile.label, tile.value])).toEqual([
      ['Total', '10'],
      ['Email (in)', '5'],
      ['Web (in)', '3'],
      ['Phone (in)', '1'],
    ])
    expect(tiles[1].note).toBe('50% of the total')
  })

  it('shows how the backlog changed in each part', () => {
    expect(backlogChanges({ 'count::created': [0, 3, 1], 'count::closed': [0, 2, 4] })).toEqual([
      { label: '·', tone: 'none' },
      { label: '+1', tone: 'up' },
      { label: '-3', tone: 'down' },
    ])
  })

  it('rounds the top of the chart up to four whole steps', () => {
    expect(niceMax(0)).toBe(4)
    expect(niceMax(7)).toBe(8)
    expect(niceMax(9)).toBe(12)
    expect(niceMax(630)).toBe(800)
    expect(niceMax(1000)).toBe(1000)
  })
})

describe('Reporting tickets', () => {
  it('keeps the order Zammad gives, with the campus', () => {
    const tickets = ticketsFromSets({
      count: 2,
      ticket_ids: [12, 11],
      assets: {
        Ticket: {
          11: {
            id: 11,
            number: '886111',
            title: 'MFA reset',
            campus: 'FSB Croydon',
            state_id: 4,
            created_at: '2026-06-18T15:53:00Z',
          },
          12: {
            id: 12,
            number: '886112',
            title: 'New laptop',
            state_id: 2,
            created_at: '2026-06-19T09:17:00Z',
          },
        },
      },
    })

    expect(tickets).toEqual([
      {
        id: 12,
        number: '886112',
        title: 'New laptop',
        campus: '',
        stateId: 2,
        createdAt: '2026-06-19T09:17:00Z',
      },
      {
        id: 11,
        number: '886111',
        title: 'MFA reset',
        campus: 'FSB Croydon',
        stateId: 4,
        createdAt: '2026-06-18T15:53:00Z',
      },
    ])
  })
})
