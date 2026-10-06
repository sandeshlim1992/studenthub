// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

// Student Hub: colours and labels of the ticket list cells in the new UI (overviews, search).
// State colours and the "due soon" point are admin settings (Administration → Branding);
// the server only accepts the palette keys below (Studenthub::Theme::TicketListSetup).

export type StudenthubStateTone = 'blue' | 'purple' | 'amber' | 'green' | 'teal' | 'red' | 'grey'

// Each pair keeps the text at WCAG AA (4.5:1) on its background; a spec checks this.
export const STUDENTHUB_STATE_TONES: Record<
  StudenthubStateTone,
  { label: string; background: string; text: string }
> = {
  blue: { label: __('Blue'), background: '#e3edf8', text: '#1f5aa6' },
  purple: { label: __('Purple'), background: '#efe8fa', text: '#6a3fb0' },
  amber: { label: __('Amber'), background: '#fff1cc', text: '#8f5b00' },
  green: { label: __('Green'), background: '#dff3e7', text: '#16794a' },
  teal: { label: __('Teal'), background: '#dcf1f0', text: '#0e6b6b' },
  red: { label: __('Red'), background: '#fde7e9', text: '#b4232f' },
  grey: { label: __('Grey'), background: '#eceef2', text: '#4a5262' },
}

export const STUDENTHUB_STATE_TONE_KEYS = Object.keys(STUDENTHUB_STATE_TONES) as StudenthubStateTone[]

// Same table as TYPE_COLORS on the server: used for states no admin has coloured yet.
const STATE_TYPE_TONES: Record<string, StudenthubStateTone> = {
  new: 'blue',
  open: 'purple',
  'pending reminder': 'amber',
  'pending action': 'amber',
  closed: 'grey',
  merged: 'grey',
  removed: 'grey',
}

export const isStateTone = (value: unknown): value is StudenthubStateTone =>
  typeof value === 'string' && value in STUDENTHUB_STATE_TONES

export const stateTypeTone = (stateTypeName?: string | null): StudenthubStateTone =>
  STATE_TYPE_TONES[stateTypeName ?? ''] ?? 'grey'

export const stateToneFor = (
  stateId: string | number | undefined,
  stateTypeName: string | null | undefined,
  savedColors: unknown,
): StudenthubStateTone => {
  const saved =
    savedColors && typeof savedColors === 'object' && stateId !== undefined
      ? (savedColors as Record<string, unknown>)[String(stateId)]
      : undefined

  return isStateTone(saved) ? saved : stateTypeTone(stateTypeName)
}

// ---- Priority: "P1 …" to "P4 …" on Student Hub, otherwise Zammad's ui_color ----

export type StudenthubPriorityLevel = 'critical' | 'high' | 'normal' | 'low' | 'none'

export const STUDENTHUB_PRIORITY_STYLES: Record<
  StudenthubPriorityLevel,
  { color: string; bars: number }
> = {
  critical: { color: '#c01d34', bars: 3 },
  high: { color: '#a34600', bars: 2 },
  normal: { color: '#806000', bars: 1 },
  low: { color: '#4a5262', bars: 1 },
  none: { color: '#5f6878', bars: 0 },
}

const PRIORITY_LEVELS_BY_NUMBER: StudenthubPriorityLevel[] = ['critical', 'high', 'normal', 'low']

export const priorityLevelFor = (
  name?: string | null,
  uiColor?: string | null,
): StudenthubPriorityLevel => {
  const number = name?.match(/^\s*P\s*([1-4])\b/i)?.[1]
  if (number) return PRIORITY_LEVELS_BY_NUMBER[Number(number) - 1]

  if (uiColor === 'high-priority') return 'high'
  if (uiColor === 'low-priority') return 'low'

  return 'none'
}

// ---- Escalation: time left until the SLA deadline ----

export const STUDENTHUB_DEFAULT_ESCALATION_WARNING_MINUTES = 60

export type StudenthubEscalationStatus = 'none' | 'overdue' | 'soon' | 'later'

export const escalationWarningMinutes = (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 2880
    ? value
    : STUDENTHUB_DEFAULT_ESCALATION_WARNING_MINUTES

export const escalationStatus = (
  escalationAt: string | null | undefined,
  now: number,
  warningMinutes: number,
): { status: StudenthubEscalationStatus; minutes: number } => {
  const deadline = escalationAt ? Date.parse(escalationAt) : NaN
  if (Number.isNaN(deadline)) return { status: 'none', minutes: 0 }

  const difference = deadline - now
  const minutes = Math.max(1, Math.round(Math.abs(difference) / 60_000))

  if (difference <= 0) return { status: 'overdue', minutes }
  if (difference <= warningMinutes * 60_000) return { status: 'soon', minutes }

  return { status: 'later', minutes }
}

// "45 min", "3 h 20 min", "1 d 4 h": short enough for a table cell.
export const formatEscalationDuration = (
  minutes: number,
  translate: (text: string, ...args: (string | number)[]) => string,
) => {
  if (minutes < 60) return translate('%s min', minutes)

  if (minutes < 24 * 60) {
    const hours = Math.floor(minutes / 60)
    const rest = minutes % 60
    return rest ? `${translate('%s h', hours)} ${translate('%s min', rest)}` : translate('%s h', hours)
  }

  const days = Math.floor(minutes / (24 * 60))
  const hours = Math.floor((minutes % (24 * 60)) / 60)
  return hours ? `${translate('%s d', days)} ${translate('%s h', hours)}` : translate('%s d', days)
}

// ---- Campus: "LSST Wembley" → badge "LSST" + "Wembley" ----

export type StudenthubInstitution = 'LSST' | 'UKBC' | 'FSB'

export const STUDENTHUB_INSTITUTION_COLORS: Record<StudenthubInstitution, string> = {
  LSST: '#c8102e',
  UKBC: '#167a36',
  FSB: '#1f4fbf',
}

export const splitCampus = (value: unknown) => {
  const text = typeof value === 'string' ? value.replaceAll('::', ' › ').trim() : ''
  const match = text.match(/^(LSST|UKBC|FSB)\b[\s:-]*(.*)$/i)

  if (!match) return { institution: null, place: text }

  return {
    institution: match[1].toUpperCase() as StudenthubInstitution,
    place: match[2].trim(),
  }
}
