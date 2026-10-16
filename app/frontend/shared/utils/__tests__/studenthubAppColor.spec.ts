// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import {
  applyStudenthubAppColor,
  contrastWithWhite,
  isHexColor,
  isUsableAppColor,
  STUDENTHUB_APP_COLOR_PRESETS,
  STUDENTHUB_DEFAULT_APP_COLOR,
} from '../studenthubAppColor.ts'

describe('studenthubAppColor', () => {
  it('measures WCAG contrast with white', () => {
    expect(contrastWithWhite('#000000')).toBeCloseTo(21, 1)
    expect(contrastWithWhite('#ffffff')).toBeCloseTo(1, 1)
    expect(contrastWithWhite('#14234b')).toBeGreaterThan(13)
  })

  it('only offers presets that keep white text readable', () => {
    STUDENTHUB_APP_COLOR_PRESETS.forEach((preset) => {
      expect(isUsableAppColor(preset.value)).toBe(true)
    })
  })

  it('recognises #rrggbb colours only', () => {
    expect(isHexColor('#14234b')).toBe(true)
    expect(isHexColor('14234b')).toBe(false)
    expect(isHexColor('#123')).toBe(false)
    expect(isHexColor(null)).toBe(false)
  })

  it('sets the CSS variable and falls back to navy for unusable values', () => {
    expect(applyStudenthubAppColor('#296374')).toBe('#296374')
    expect(document.documentElement.style.getPropertyValue('--sh-app')).toBe('#296374')

    expect(applyStudenthubAppColor('#ffca08')).toBe(STUDENTHUB_DEFAULT_APP_COLOR)
    expect(applyStudenthubAppColor(undefined)).toBe(STUDENTHUB_DEFAULT_APP_COLOR)
    expect(document.documentElement.style.getPropertyValue('--sh-app')).toBe(STUDENTHUB_DEFAULT_APP_COLOR)
  })
})
