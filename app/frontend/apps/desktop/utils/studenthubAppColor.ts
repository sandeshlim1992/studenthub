// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

// Student Hub: the application colour admins choose under Administration → Branding.
// It sits behind white text, so the same contrast rule as the server applies here.

export const STUDENTHUB_DEFAULT_APP_COLOR = '#14234b'
export const STUDENTHUB_MIN_APP_COLOR_CONTRAST = 4.5

export const STUDENTHUB_APP_COLOR_PRESETS = [
  { name: __('Navy'), value: '#14234b', note: __('From the Student Hub logo') },
  { name: __('Teal'), value: '#296374', note: __('Used by the old feedback pages') },
  { name: __('Maroon'), value: '#7e0707', note: __('Deep red') },
  { name: __('Plum'), value: '#4b2a7a', note: __('Deep purple') },
  { name: __('Charcoal'), value: '#2b313b', note: __('Neutral dark grey') },
]

export const isHexColor = (value: unknown): value is string =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)

// WCAG 2 contrast ratio between the colour and white.
export const contrastWithWhite = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((index) => {
    const channel = parseInt(hex.slice(index, index + 2), 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return 1.05 / (luminance + 0.05)
}

export const isUsableAppColor = (value: unknown): value is string =>
  isHexColor(value) && contrastWithWhite(value) >= STUDENTHUB_MIN_APP_COLOR_CONTRAST

export const applyStudenthubAppColor = (value: unknown) => {
  const color = isUsableAppColor(value) ? value : STUDENTHUB_DEFAULT_APP_COLOR
  document.documentElement.style.setProperty('--sh-app', color)
  return color
}
