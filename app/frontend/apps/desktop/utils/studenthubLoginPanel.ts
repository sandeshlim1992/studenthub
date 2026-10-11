// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

// Student Hub: the heading, tagline and description in the sign-in page's brand panel
// (setting "studenthub_login_panel", edited on the Branding page). An empty text hides that line.

export type StudenthubLoginPanelField = 'heading' | 'tagline' | 'description'

export type StudenthubLoginPanelTexts = Record<StudenthubLoginPanelField, string>

export const STUDENTHUB_LOGIN_PANEL_FIELDS: StudenthubLoginPanelField[] = ['heading', 'tagline', 'description']

// Same limits as the server (Studenthub::Theme::LoginPanelSetup::MAX_LENGTHS).
export const STUDENTHUB_LOGIN_PANEL_MAX_LENGTHS: Record<StudenthubLoginPanelField, number> = {
  heading: 60,
  tagline: 120,
  description: 300,
}

export const STUDENTHUB_LOGIN_PANEL_DEFAULTS: StudenthubLoginPanelTexts = {
  heading: __('Student Hub'),
  tagline: __('Your support, simplified.'),
  description: __(
    'IT and student support for LSST, FSB and UKBC. Ask for help, follow your requests and find answers in one place.',
  ),
}

// The setting's value as texts; the defaults where it is missing (before the migration has run).
export const readStudenthubLoginPanel = (value: unknown): StudenthubLoginPanelTexts => {
  const saved = value && typeof value === 'object' ? (value as Partial<Record<string, unknown>>) : {}

  return Object.fromEntries(
    STUDENTHUB_LOGIN_PANEL_FIELDS.map((field) => {
      const text = saved[field]
      return [field, typeof text === 'string' ? text : STUDENTHUB_LOGIN_PANEL_DEFAULTS[field]]
    }),
  ) as StudenthubLoginPanelTexts
}
